// src/app/api/contract/route.ts
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  BOOKING_MODERATION_SECRET,
  BOOKING_NOTIFY_EMAIL,
  BOOKING_REPLY_TO,
  RESEND_FROM,
  SITE_URL,
  requireResend,
} from "@/lib/resendServer";
import { verifyContractToken } from "@/lib/contractToken";
import crypto from "crypto";

/**
 * IMPORTANT
 * - On garde UNE SEULE route : /api/contract
 * - On ne touche pas aux autres routes / emails existants
 *
 * Flow OTP email (6 chiffres) :
 * 1) action=send_otp  -> upsert infos contrat (sans signed_at) + envoi OTP par email
 * 2) action=verify_otp -> vérifie OTP + set signed_at + email post-signature (RIB + annexe 3 + bouton "virement envoyé")
 * 3) action=transfer_sent -> enregistre "virement envoyé" (si colonne existe), sinon no-op + notifie propriétaire
 *
 * ⚠️ NOTE DB
 * - Cette implémentation ne nécessite PAS de table OTP dédiée.
 * - OTP est "stateless" (dérivé HMAC + fenêtre temps) : pas de colonne à ajouter.
 * - Pour tracer légalement + finement (attempts, expiry, etc.), on pourra ajouter des colonnes plus tard.
 */

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) {
  return String(v ?? "").trim();
}

function __isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function __isPositiveIntString(s: string) {
  return /^[0-9]+$/.test(s) && Number.isFinite(Number(s)) && Number(s) > 0;
}

function normalizeRid(rid: string | null) {
  const s = mustStr(rid);
  if (!s) return null;
  if (__isUuid(s)) return s;
  if (__isPositiveIntString(s)) return String(Math.trunc(Number(s)));
  return null;
}

function formatDateFR(d: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d);
  if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function nightsBetween(arrival: string, departure: string) {
  const a = new Date(`${arrival}T00:00:00Z`).getTime();
  const b = new Date(`${departure}T00:00:00Z`).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function toMoneyEUR(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(2)} €`;
}

function pickNumber(obj: any, keys: string[]): number | null {
  const o = obj || {};
  for (const k of keys) {
    const v = o?.[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ✅ Date contrat : validation stricte + date réelle (pas 31/02)
// ✅ Accepte "JJ/MM/AAAA" OU "JJMMAAAA" (utile sur mobile iOS)
function parseContractDateFR(
  input: string
): { ok: true; normalized: string } | { ok: false } {
  const s = mustStr(input);

  let dd: number;
  let mm: number;
  let yyyy: number;

  // 1) format avec /
  const m1 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m1) {
    dd = Number(m1[1]);
    mm = Number(m1[2]);
    yyyy = Number(m1[3]);
  } else {
    // 2) format compact : on prend uniquement les chiffres
    const digits = s.replace(/\D/g, "");
    if (!/^\d{8}$/.test(digits)) return { ok: false };
    dd = Number(digits.slice(0, 2));
    mm = Number(digits.slice(2, 4));
    yyyy = Number(digits.slice(4, 8));
  }

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy))
    return { ok: false };
  if (yyyy < 1900 || yyyy > 2200) return { ok: false };
  if (mm < 1 || mm > 12) return { ok: false };
  if (dd < 1 || dd > 31) return { ok: false };

  // validation calendrier réelle
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return { ok: false };
  }

  const normalized = `${String(dd).padStart(2, "0")}/${String(mm).padStart(
    2,
    "0"
  )}/${String(yyyy).padStart(4, "0")}`;

  return { ok: true, normalized };
}

/**
 * ✅ Options éventuelles = somme de TOUTES les options réellement présentes dans pricing,
 * sans inventer, et sans compter les champs "non-options" (total, taxes, base, etc.)
 */
function computeOptionsTotalFromPricing(pricing: any): number {
  const p = pricing && typeof pricing === "object" ? pricing : {};

  // Champs connus "non-options" à EXCLURE de la somme des options
  const excluded = new Set<string>([
    "total",
    "cleaning",
    "tourist_tax",
    "tax",
    "taxes",
    "base",
    "base_accommodation",
    "accommodation",
    "accommodation_total",
    "subtotal",
    "nights",
    "nightly_rate",
    "rate",
    "adults",
    "children",
    "currency",
    "options_total", // on le gère à part
  ]);

  // ✅ si options_total est présent, on le respecte
  const direct = Number((p as any).options_total);
  if (Number.isFinite(direct)) return round2(direct);

  let sum = 0;
  for (const [k, v] of Object.entries(p)) {
    if (excluded.has(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
  }
  return round2(sum);
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * OTP "stateless" : code 6 chiffres basé sur une fenêtre de temps (10 min)
 * + HMAC secret = BOOKING_MODERATION_SECRET
 * -> pas besoin de stocker en DB.
 */
const OTP_WINDOW_SEC = 10 * 60;

function otpSecret(): string {
  // si secret absent, on génère un "secret" faible pour éviter crash
  // (mais idéalement BOOKING_MODERATION_SECRET doit être défini en prod)
  const s = String(BOOKING_MODERATION_SECRET || "").trim();
  return s || "MISSING_BOOKING_MODERATION_SECRET";
}

function otpWindow(nowSec: number) {
  return Math.floor(nowSec / OTP_WINDOW_SEC);
}

function computeOtpCode(args: { rid: string; email: string; window: number }) {
  const h = crypto.createHmac("sha256", otpSecret());
  h.update(`${args.rid}.${String(args.email || "").toLowerCase().trim()}.${args.window}`);
  const digest = h.digest();
  // prendre 4 octets -> number -> 6 digits
  const n = digest.readUInt32BE(0);
  const code = String(n % 1_000_000).padStart(6, "0");
  return code;
}

function verifyOtpCode(args: { rid: string; email: string; code: string }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const w = otpWindow(nowSec);
  const cleaned = String(args.code || "").replace(/\D/g, "").slice(0, 6);
  if (cleaned.length !== 6) return false;

  // ✅ accepte fenêtre courante + précédente (tolérance)
  const c1 = computeOtpCode({ rid: args.rid, email: args.email, window: w });
  const c2 = computeOtpCode({ rid: args.rid, email: args.email, window: w - 1 });
  return cleaned === c1 || cleaned === c2;
}

/**
 * Lien signé "transfer sent" pour bouton email
 */
function signTransferLink(args: { rid: string; email: string; token: string }) {
  const h = crypto.createHmac("sha256", otpSecret());
  h.update(`transfer.${args.rid}.${String(args.email || "").toLowerCase().trim()}.${args.token}`);
  return h.digest("hex").slice(0, 32);
}

function verifyTransferLink(args: { rid: string; email: string; token: string; k: string }) {
  const expected = signTransferLink({ rid: args.rid, email: args.email, token: args.token });
  return String(args.k || "") === expected;
}

function baseUrl() {
  return SITE_URL ? SITE_URL.replace(/\/$/, "") : "";
}

/**
 * ANNEXE 3 : on la met dans l'email post-signature.
 * ➜ Ici : PLACEHOLDER (car ton annexe 3 complète est déjà dans ContractClient).
 * Si tu veux 100% identique, tu me colles ton fichier PaiementSection.tsx et/ou
 * on met Annexe3 dans un fichier partagé côté serveur.
 */
const ANNEXE3_TEXT = `ANNEXE 3 — RÈGLEMENT INTÉRIEUR
(voir le contrat en ligne : annexe 3 incluse en bas du contrat)`;

/**
 * RIB : PLACEHOLDER (à remplacer par ton texte exact de PaiementSection.tsx)
 * -> tu m'envoies le fichier PaiementSection.tsx et je l'injecte à l'identique.
 */
const RIB_TEXT = `RIB (VIREMENT BANCAIRE) — à compléter
IBAN : [IBAN]
BIC : [BIC]
Titulaire : [Nom / Titulaire]`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rid = normalizeRid(searchParams.get("rid"));
  const t = searchParams.get("t") || "";
  const action = mustStr(searchParams.get("action") || "");
  const k = mustStr(searchParams.get("k") || "");

  if (!rid) return jsonError("Missing rid", 400);

  const supabase = requireSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .select(
      "id, created_at, name, email, phone, start_date, end_date, adults, children, animals_count, message, pricing"
    )
    .eq("id", rid)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!booking) return jsonError("Booking request not found", 404);

  const okToken = verifyContractToken({
    rid,
    email: booking.email,
    secret: BOOKING_MODERATION_SECRET,
    token: t,
  });
  if (!okToken) return jsonError("Invalid token", 403);

  // ✅ Action "transfer_sent" via bouton email (GET signé)
  if (action === "transfer_sent") {
    const okK = verifyTransferLink({ rid, email: booking.email, token: t, k });
    if (!okK) return jsonError("Invalid link", 403);

    // best-effort: si colonnes n'existent pas, on ignore sans casser
    try {
      await supabase
        .from("booking_contracts")
        .update({
          transfer_declared_at: new Date().toISOString(),
          transfer_declared: true,
        } as any)
        .eq("booking_request_id", rid);
    } catch {
      // ignore
    }

    // notif propriétaire
    const resend = requireResend();
    const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];
    if (recipientsOwner.length) {
      await resend.emails.send({
        from: RESEND_FROM,
        to: recipientsOwner,
        replyTo: BOOKING_REPLY_TO || undefined,
        subject: `Virement déclaré envoyé (30%) — Demande #${rid}`,
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
            <h2>Virement déclaré envoyé (30%)</h2>
            <p><b>Réservant</b> : ${escapeHtml(booking.name)} — ${escapeHtml(booking.email)}</p>
            <p><b>Demande</b> : #${escapeHtml(rid)}</p>
            <p>Le locataire a cliqué : <b>“J’ai bien envoyé le virement des 30%”</b>.</p>
            <p>⚠️ À vérifier sur ton compte bancaire.</p>
          </div>
        `,
      });
    }

    // page simple
    const url = `${baseUrl()}/contract?rid=${encodeURIComponent(rid)}&t=${encodeURIComponent(t)}`;
    return new NextResponse(
      `
      <!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Confirmation</title></head>
      <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45;padding:24px;">
        <h2>Merci ✅</h2>
        <p>Votre confirmation a été enregistrée.</p>
        <p><a href="${url}">Retour au contrat</a></p>
      </body></html>
      `,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const { data: contract, error: cErr } = await supabase
    .from("booking_contracts")
    .select(
      "id, booking_request_id, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants, signed_at, contract_date"
    )
    .eq("booking_request_id", rid)
    .maybeSingle();

  if (cErr) return jsonError(cErr.message, 500);

  return NextResponse.json({ ok: true, booking, contract });
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = mustStr(body?.action || "");
  const rid = normalizeRid(mustStr(body?.rid));
  const t = mustStr(body?.t);

  if (!rid) return jsonError("Missing rid", 400);

  const supabase = requireSupabaseAdmin();

  const { data: booking, error: bookingErr } = await supabase
    .from("booking_requests")
    .select("id, name, email, phone, start_date, end_date, pricing, created_at")
    .eq("id", rid)
    .maybeSingle();

  if (bookingErr) return jsonError(bookingErr.message, 500);
  if (!booking) return jsonError("Booking request not found", 404);

  const okToken = verifyContractToken({
    rid,
    email: booking.email,
    secret: BOOKING_MODERATION_SECRET,
    token: t,
  });
  if (!okToken) return jsonError("Invalid token", 403);

  // --- common validated fields (for saving contract draft) ---
  const addressLine1 = mustStr(body?.signer_address_line1);
  const addressLine2 = mustStr(body?.signer_address_line2);
  const postalCode = mustStr(body?.signer_postal_code);
  const city = mustStr(body?.signer_city);
  const country = mustStr(body?.signer_country);
  const occupants = Array.isArray(body?.occupants) ? body.occupants : [];
  const acceptedTerms = Boolean(body?.accepted_terms);

  // ✅ date du contrat obligatoire (JJ/MM/AAAA ou JJMMAAAA)
  const contractDateRaw = mustStr(body?.contract_date);
  const parsedContractDate = parseContractDateFR(contractDateRaw);
  if (!parsedContractDate.ok) {
    return jsonError(
      "Merci de renseigner la date du contrat au format JJ/MM/AAAA (ou JJMMAAAA).",
      400
    );
  }
  const contractDate = parsedContractDate.normalized;

  const normOccupants = occupants
    .map((o: any) => ({
      first_name: mustStr(o?.first_name),
      last_name: mustStr(o?.last_name),
      age: mustStr(o?.age),
    }))
    .filter((o: any) => o.first_name && o.last_name && o.age);

  if (!addressLine1 || !postalCode || !city || !country) {
    return jsonError("Adresse incomplète.", 400);
  }
  if (!acceptedTerms) {
    return jsonError("Vous devez accepter le contrat.", 400);
  }
  if (normOccupants.length === 0) {
    return jsonError("Ajoutez au moins une personne (nom, prénom, âge).", 400);
  }
  if (normOccupants.length > 8) {
    return jsonError("Maximum 8 personnes.", 400);
  }

  // ✅ Save draft (upsert) — sans marquer signed_at
  const { data: saved, error: upErr } = await supabase
    .from("booking_contracts")
    .upsert(
      {
        booking_request_id: rid,
        signer_address_line1: addressLine1,
        signer_address_line2: addressLine2 || null,
        signer_postal_code: postalCode,
        signer_city: city,
        signer_country: country,
        occupants: normOccupants,
        contract_date: contractDate,
        ip: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      } as any,
      { onConflict: "booking_request_id" }
    )
    .select("id, booking_request_id, signed_at, contract_date")
    .single();

  if (upErr) return jsonError(upErr.message, 500);

  // --- pricing recap (for deposit) ---
  const p = booking?.pricing || {};
  const totalN = pickNumber(p, ["total"]) ?? null;
  const cleaningN = 100;
  const touristTaxN = pickNumber(p, ["tourist_tax"]) ?? 0;
  const optionsN = computeOptionsTotalFromPricing(p);

  let accommodationN = pickNumber(p, ["base_accommodation", "accommodation"]) ?? null;
  if (accommodationN == null && totalN != null) {
    const computed = totalN - cleaningN - optionsN - touristTaxN;
    accommodationN = Number.isFinite(computed) && computed >= 0 ? round2(computed) : null;
  }

  const deposit30N = totalN != null ? round2(totalN * 0.3) : null;
  const soldeN =
    totalN != null && deposit30N != null ? round2(totalN - deposit30N) : null;

  // --- ACTIONS ---
  if (action === "send_otp") {
    const resend = requireResend();
    const nowSec = Math.floor(Date.now() / 1000);
    const w = otpWindow(nowSec);
    const code = computeOtpCode({ rid, email: booking.email, window: w });

    await resend.emails.send({
      from: RESEND_FROM,
      to: [booking.email],
      replyTo: BOOKING_REPLY_TO || undefined,
      subject: "Code de signature électronique (6 chiffres)",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
          <h2>Votre code de signature (6 chiffres)</h2>
          <p>Pour confirmer votre signature électronique, saisissez ce code dans le contrat :</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:4px;margin:16px 0">${escapeHtml(code)}</div>
          <p>Ce code est envoyé à l’adresse email utilisée pour la réservation. Il permet de confirmer que la personne qui réserve a bien accès à cette boîte email.</p>
          <p style="color:#64748b;font-size:12px">Validité : environ 10 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, otp_sent: true, deposit30: deposit30N });
  }

  if (action === "verify_otp") {
    const code = mustStr(body?.otp_code);
    const ok = verifyOtpCode({ rid, email: booking.email, code });
    if (!ok) return jsonError("Code invalide. Réessayez.", 400);

    // ✅ marque comme signé (locataire)
    try {
      await supabase
        .from("booking_contracts")
        .update({
          signed_at: new Date().toISOString(),
          signed_method: "otp_email",
        } as any)
        .eq("booking_request_id", rid);
    } catch {
      // si colonne signed_method n'existe pas, on ignore
      await supabase
        .from("booking_contracts")
        .update({ signed_at: new Date().toISOString() } as any)
        .eq("booking_request_id", rid);
    }

    // ✅ Email post-signature (locataire) — avec RIB + bouton
    const resend = requireResend();
    const contractUrl = `${baseUrl()}/contract?rid=${encodeURIComponent(
      rid
    )}&t=${encodeURIComponent(t)}`;

    const transferK = signTransferLink({ rid, email: booking.email, token: t });
    const transferUrl = `${baseUrl()}/api/contract?rid=${encodeURIComponent(
      rid
    )}&t=${encodeURIComponent(t)}&action=transfer_sent&k=${encodeURIComponent(
      transferK
    )}`;

    const arrivalYmd = String(booking.start_date || "").trim();
    const departureYmd = String(booking.end_date || "").trim();

    const deposit30Text = deposit30N != null ? toMoneyEUR(deposit30N) : "[____ €]";
    const soldeText = soldeN != null ? toMoneyEUR(soldeN) : "[____ €]";
    const totalText = totalN != null ? toMoneyEUR(totalN) : "[____ €]";

    await resend.emails.send({
      from: RESEND_FROM,
      to: [booking.email],
      replyTo: BOOKING_REPLY_TO || undefined,
      subject: "Contrat signé ✅ — Paiement de l’acompte (30%)",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
          <h2>Merci ! Votre contrat est signé ✅</h2>

          <p><b>Récap séjour</b></p>
          <ul>
            <li>Dates : ${escapeHtml(formatDateFR(arrivalYmd))} → ${escapeHtml(
        formatDateFR(departureYmd)
      )} (${nightsBetween(arrivalYmd, departureYmd)} nuit(s))</li>
            <li>Total : <b>${escapeHtml(totalText)}</b></li>
            <li>Acompte (30%) : <b>${escapeHtml(deposit30Text)}</b></li>
            <li>Solde : <b>${escapeHtml(soldeText)}</b> (au plus tard 7 jours avant l’entrée dans les lieux)</li>
          </ul>

          <p><b>Pour bloquer vos dates de réservation</b>, merci d’effectuer le virement de l’acompte (30%), soit <b>${escapeHtml(
            deposit30Text
          )}</b>.</p>

          <p><b>RIB</b></p>
          <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(
            RIB_TEXT
          )}</pre>

          <p>Après envoi du virement, cliquez ici :</p>
          <p>
            <a href="${transferUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700">
              J’ai bien envoyé le virement des 30%
            </a>
          </p>

          <hr/>
          <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(
            ANNEXE3_TEXT
          )}</pre>

          <p style="color:#64748b;font-size:12px">Vous pouvez retrouver le contrat complet (avec annexes) ici : <a href="${contractUrl}">${contractUrl}</a></p>
        </div>
      `,
    });

    // ✅ Notif propriétaire (sans casser les templates existants ailleurs)
    const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];
    if (recipientsOwner.length) {
      await resend.emails.send({
        from: RESEND_FROM,
        to: recipientsOwner,
        replyTo: BOOKING_REPLY_TO || undefined,
        subject: `Contrat signé (OTP email) — Demande #${rid}`,
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
            <h2>Contrat signé (locataire)</h2>
            <p><b>Demande</b> : #${escapeHtml(rid)}</p>
            <p><b>Locataire</b> : ${escapeHtml(booking.name)} — ${escapeHtml(booking.email)} — ${escapeHtml(
          booking.phone || ""
        )}</p>
            <p><b>Contrat</b> : <a href="${contractUrl}">ouvrir</a></p>
            <p>⚠️ Étape suivante : attendre le virement (30%) puis signer côté propriétaire (étape à automatiser ensuite si tu veux une double-signature stockée en DB).</p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      signed: true,
      deposit30: deposit30N,
    });
  }

  if (action === "transfer_sent") {
    // déclaration virement depuis la pop-up (POST)
    // best-effort DB
    try {
      await supabase
        .from("booking_contracts")
        .update({
          transfer_declared_at: new Date().toISOString(),
          transfer_declared: true,
        } as any)
        .eq("booking_request_id", rid);
    } catch {
      // ignore
    }

    const resend = requireResend();
    const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];
    if (recipientsOwner.length) {
      await resend.emails.send({
        from: RESEND_FROM,
        to: recipientsOwner,
        replyTo: BOOKING_REPLY_TO || undefined,
        subject: `Virement déclaré envoyé (30%) — Demande #${rid}`,
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
            <h2>Virement déclaré envoyé (30%)</h2>
            <p><b>Réservant</b> : ${escapeHtml(booking.name)} — ${escapeHtml(booking.email)}</p>
            <p><b>Demande</b> : #${escapeHtml(rid)}</p>
            <p>Le locataire a cliqué : <b>“virement envoyé”</b>.</p>
            <p>⚠️ À vérifier sur ton compte bancaire.</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  }

  // fallback: just saved draft
  return NextResponse.json({
    ok: true,
    saved: true,
    contract: saved,
    deposit30: deposit30N,
  });
}
