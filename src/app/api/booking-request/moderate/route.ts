// src/app/api/booking-request/moderate/route.ts
import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend, RESEND_FROM, BOOKING_MODERATION_SECRET } from "@/lib/resendServer";

export const runtime = "nodejs";

/**
 * GET /api/booking-request/moderate?id=...&action=...&exp=...&sig=...
 *
 * ✅ Ce endpoint est appelé depuis les boutons de l'email admin.
 * Il valide la signature HMAC + expiration puis :
 * - action=accepted  -> update status=accepted + email client (Texte #3 exact) + redirect /booking/accepted
 * - action=refused   -> update status=refused  + email client (Texte #4 exact) + redirect /booking/refused
 * - action=reply     -> pas d'update, redirect /booking/reply
 *
 * ⚠️ Compatibilité :
 * - Anciennes valeurs possibles : action=accept / action=reject
 * - Ancien format de signature possible : msg = `${id}.${action}.${exp}`
 * - Nouveau format : base = `id=${id}&action=${action}&exp=${exp}`
 */

type ActionNormalized = "accepted" | "refused" | "reply";

function normalizeAction(actionRaw: string): ActionNormalized | null {
  const a = (actionRaw || "").trim().toLowerCase();
  if (a === "accepted" || a === "accept") return "accepted";
  if (a === "refused" || a === "rejected" || a === "reject") return "refused";
  if (a === "reply") return "reply";
  return null;
}

function verifySig(params: { id: string; actionRaw: string; exp: string; sig: string }) {
  const secret = BOOKING_MODERATION_SECRET;
  if (!secret) return false;

  const expNum = Number(params.exp);
  if (!Number.isFinite(expNum)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (expNum < now) return false;

  const action = normalizeAction(params.actionRaw);
  if (!action) return false;

  // ✅ Nouveau format (recommandé)
  const baseNew = `id=${params.id}&action=${action}&exp=${params.exp}`;
  const expectedNew = createHmac("sha256", secret).update(baseNew).digest("hex");

  // ✅ Ancien format (compat)
  const baseOld = `${params.id}.${params.actionRaw}.${params.exp}`;
  const expectedOld = createHmac("sha256", secret).update(baseOld).digest("hex");

  // Compare strict (hex)
  return expectedNew === params.sig || expectedOld === params.sig;
}

function redirectTo(origin: string, path: string) {
  const res = NextResponse.redirect(new URL(path, origin), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function escapeHtml(input: string) {
  return (input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const id = (url.searchParams.get("id") || "").trim();
  const actionRaw = (url.searchParams.get("action") || "").trim();
  const exp = (url.searchParams.get("exp") || "").trim();
  const sig = (url.searchParams.get("sig") || "").trim();

  // Lien incomplet / invalide / expiré → page refused
  if (!id || !actionRaw || !exp || !sig) {
    return redirectTo(origin, "/booking/refused");
  }
  if (!verifySig({ id, actionRaw, exp, sig })) {
    return redirectTo(origin, "/booking/refused");
  }

  const action = normalizeAction(actionRaw);
  if (!action) return redirectTo(origin, "/booking/refused");

  // Helper : récupérer la demande (pour envoyer les emails)
  async function getRequest() {
    const { data, error } = await supabaseAdmin
      .from("booking_requests")
      .select("id, status, name, email, start_date, end_date, nights")
      .eq("id", id)
      .single();

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

  // --- ACCEPT ---
  if (action === "accepted") {
    const { error: upErr } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "accepted", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (upErr) return redirectTo(origin, "/booking/refused");

    const r = await getRequest();
    if (r?.email && r?.name && r?.start_date && r?.end_date && (r.nights ?? 0) > 0) {
      try {
        const property_name = "Superbe bergerie en cœur de forêt – piscine & lac";
        const guest_name = r.name;
        const checkin_date = r.start_date;
        const checkout_date = r.end_date;
        const nights = r.nights ?? 0;
        const host_name = "Coralie";

        const contract_link = new URL(`/contract?rid=${encodeURIComponent(id)}`, origin).toString();

        const subject =
          "Votre demande de réservation est acceptée — étape suivante : contrat & acompte";

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

  // --- REFUSE ---
  if (action === "refused") {
    const { error: upErr } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "refused", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (upErr) return redirectTo(origin, "/booking/refused");

    const r = await getRequest();
    if (r?.email && r?.name && r?.start_date && r?.end_date) {
      try {
        const property_name = "Superbe bergerie en cœur de forêt – piscine & lac";
        const guest_name = r.name;
        const checkin_date = r.start_date;
        const checkout_date = r.end_date;
        const host_name = "Coralie";

        const subject = `Indisponibilité — ${property_name}`;

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
          )} → ${escapeHtml(
            checkout_date
          )}, car le logement n’est pas disponible sur cette période.</p>` +
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

  // --- REPLY ---
  if (action === "reply") {
    return redirectTo(origin, "/booking/reply");
  }

  return redirectTo(origin, "/booking/refused");
}
