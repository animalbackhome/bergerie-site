// src/app/api/booking-request/moderate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { resend, RESEND_FROM, BOOKING_MODERATION_SECRET } from "@/lib/resendServer";

export const runtime = "nodejs";

/**
 * GET /api/booking-request/moderate?id=...&action=...&exp=...&sig=...
 * - Vérifie la signature (HMAC) + expiration
 * - Met à jour la demande dans Supabase (booking_requests)
 * - Envoie l'email client (accept/refuse) si possible
 * - Redirige vers /booking/accepted | /booking/refused | /booking/reply
 *
 * NOTE IMPORTANT (compat) :
 * - Certaines versions utilisaient action=accept/reject/reply
 * - D'autres utilisent action=accepted/refused/reply
 * => On supporte les 2 pour éviter de casser des liens déjà envoyés.
 */

/* ------------------ Supabase admin ------------------ */

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function getSupabaseAdmin() {
  const url = pickEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_PROJECT_URL");
  const serviceRoleKey = pickEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_KEY"
  );

  if (!url) {
    throw new Error("Missing Supabase URL env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing Supabase service role env. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).");
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

/* ------------------ Security ------------------ */

function verifySig(params: { id: string; action: string; exp: string; sig: string }) {
  if (!BOOKING_MODERATION_SECRET) return false;

  const expNum = Number(params.exp);
  if (!Number.isFinite(expNum)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (expNum < now) return false;

  const msg = `${params.id}.${params.action}.${params.exp}`;
  const expected = createHmac("sha256", BOOKING_MODERATION_SECRET).update(msg).digest("hex");
  return expected === params.sig;
}

function redirectTo(origin: string, path: string) {
  const res = NextResponse.redirect(new URL(path, origin), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------ Handler ------------------ */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const id = url.searchParams.get("id") || "";
  const actionRaw = url.searchParams.get("action") || "";
  const exp = url.searchParams.get("exp") || "";
  const sig = url.searchParams.get("sig") || "";

  // Lien incomplet / invalide / expiré → page refused
  if (!id || !actionRaw || !exp || !sig) return redirectTo(origin, "/booking/refused");
  if (!verifySig({ id, action: actionRaw, exp, sig })) return redirectTo(origin, "/booking/refused");

  // Compat actions
  const action =
    actionRaw === "accept" ? "accepted" :
    actionRaw === "reject" ? "refused" :
    actionRaw;

  const supabase = getSupabaseAdmin();

  // Petit helper : récupérer la demande (pour envoyer les emails)
  async function getRequest() {
    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, status, name, email, start_date, end_date, nights")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return data as {
      id: string;
      status: string | null;
      name: string | null;
      email: string | null;
      start_date: string | null;
      end_date: string | null;
      nights: number | null;
    };
  }

  if (action === "accepted") {
    // 1) Update statut
    const { error: upErr } = await supabase
      .from("booking_requests")
      .update({ status: "accepted", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (upErr) return redirectTo(origin, "/booking/refused");

    // 2) Récup demande + envoi mail TEXTE #3 EXACT
    const r = await getRequest();
    if (r?.email && r?.name && r?.start_date && r?.end_date && (r.nights ?? 0) > 0) {
      try {
        const property_name = "Superbe bergerie en cœur de forêt – piscine & lac";
        const guest_name = r.name;
        const checkin_date = r.start_date;
        const checkout_date = r.end_date;
        const nights = r.nights ?? 0;
        const host_name = "Coralie";

        // ⚠️ Lien contrat : on le met déjà, la page contrat viendra ensuite
        const contract_link = new URL(`/contract?rid=${encodeURIComponent(id)}`, origin).toString();

        // Objet TEXTE #3 EXACT
        const subject = "Votre demande de réservation est acceptée — étape suivante : contrat & acompte";

        // Contenu TEXTE #3 EXACT
        const text =
          `Bonjour ${guest_name},\n` +
          `Bonne nouvelle : votre demande de réservation est acceptée pour ${property_name} aux dates suivantes : ${checkin_date} → ${checkout_date} (${nights} nuit(s)).\n` +
          `Afin de valider votre réservation et pouvoir vous accueillir, merci de suivre les deux étapes suivantes :\n` +
          `\n` +
          `Étape 1 — Contrat à compléter et signer\n` +
          `Merci de compléter et signer le contrat via le lien ci-dessous :\n` +
          `${contract_link}\n` +
          `\n` +
          `Étape 2 — Acompte de 30% à régler après signature\n` +
          `Une fois le contrat signé, vous recevrez automatiquement les informations de paiement (RIB) ainsi que le montant exact de l’acompte.\n` +
          `Important : si vous ne voyez pas nos messages, merci de vérifier votre dossier Courrier indésirable / Spam et l’onglet Promotions (Gmail).\n` +
          `Cordialement,\n` +
          `${host_name} — ${property_name}`;

        const html =
          `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6">` +
          `<p>Bonjour ${escapeHtml(guest_name)},</p>` +
          `<p>Bonne nouvelle : votre demande de réservation est acceptée pour ${escapeHtml(
            property_name
          )} aux dates suivantes : ${escapeHtml(checkin_date)} → ${escapeHtml(checkout_date)} (${nights} nuit(s)).</p>` +
          `<p>Afin de valider votre réservation et pouvoir vous accueillir, merci de suivre les deux étapes suivantes :</p>` +
          `<p><b>Étape 1 — Contrat à compléter et signer</b><br/>` +
          `Merci de compléter et signer le contrat via le lien ci-dessous :<br/>` +
          `<a href="${escapeHtml(contract_link)}">${escapeHtml(contract_link)}</a></p>` +
          `<p><b>Étape 2 — Acompte de 30% à régler après signature</b><br/>` +
          `Une fois le contrat signé, vous recevrez automatiquement les informations de paiement (RIB) ainsi que le montant exact de l’acompte.</p>` +
          `<p><b>Important : si vous ne voyez pas nos messages, merci de vérifier votre dossier Courrier indésirable / Spam et l’onglet Promotions (Gmail).</b></p>` +
          `<p>Cordialement,<br/>${escapeHtml(host_name)} — ${escapeHtml(property_name)}</p>` +
          `</div>`;

        await resend.emails.send({
          from: RESEND_FROM,
          to: r.email,
          subject,
          text,
          html,
        });
      } catch (e) {
        console.warn("Accept email send failed:", e);
      }
    }

    return redirectTo(origin, "/booking/accepted");
  }

  if (action === "refused") {
    // 1) Update statut
    const { error: upErr } = await supabase
      .from("booking_requests")
      .update({ status: "refused", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (upErr) return redirectTo(origin, "/booking/refused");

    // 2) Récup demande + envoi mail TEXTE #4 EXACT
    const r = await getRequest();
    if (r?.email && r?.name && r?.start_date && r?.end_date) {
      try {
        const property_name = "Superbe bergerie en cœur de forêt – piscine & lac";
        const guest_name = r.name;
        const checkin_date = r.start_date;
        const checkout_date = r.end_date;
        const host_name = "Coralie";

        // Objet TEXTE #4 EXACT
        const subject = `Indisponibilité — ${property_name}`;

        // Contenu TEXTE #4 EXACT
        const text =
          `Bonjour ${guest_name},\n` +
          `Merci pour votre demande concernant ${property_name}.\n` +
          `Malheureusement, nous ne pouvons pas donner suite pour les dates ${checkin_date} → ${checkout_date}, car le logement n’est pas disponible sur cette période.\n` +
          `Si vous le souhaitez, vous pouvez nous proposer d’autres dates.\n` +
          `Cordialement,\n` +
          `${host_name} — ${property_name}`;

        const html =
          `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.6">` +
          `<p>Bonjour ${escapeHtml(guest_name)},</p>` +
          `<p>Merci pour votre demande concernant ${escapeHtml(property_name)}.</p>` +
          `<p>Malheureusement, nous ne pouvons pas donner suite pour les dates ${escapeHtml(
            checkin_date
          )} → ${escapeHtml(checkout_date)}, car le logement n’est pas disponible sur cette période.</p>` +
          `<p>Si vous le souhaitez, vous pouvez nous proposer d’autres dates.</p>` +
          `<p>Cordialement,<br/>${escapeHtml(host_name)} — ${escapeHtml(property_name)}</p>` +
          `</div>`;

        await resend.emails.send({
          from: RESEND_FROM,
          to: r.email,
          subject,
          text,
          html,
        });
      } catch (e) {
        console.warn("Reject email send failed:", e);
      }
    }

    return redirectTo(origin, "/booking/refused");
  }

  if (action === "reply") {
    // “Répondre” = ne change pas le statut, juste une page d’info.
    return redirectTo(origin, "/booking/reply");
  }

  return redirectTo(origin, "/booking/refused");
}
