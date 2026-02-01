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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) {
  return String(v ?? "").trim();
}

function __isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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

function parseContractDateFR(input: string): { ok: true; normalized: string } | { ok: false } {
  const s = mustStr(input);
  let dd: number, mm: number, yyyy: number;
  const m1 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m1) {
    dd = Number(m1[1]); mm = Number(m1[2]); yyyy = Number(m1[3]);
  } else {
    const digits = s.replace(/\D/g, "");
    if (!/^\d{8}$/.test(digits)) return { ok: false };
    dd = Number(digits.slice(0, 2)); mm = Number(digits.slice(2, 4)); yyyy = Number(digits.slice(4, 8));
  }
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return { ok: false };
  if (yyyy < 1900 || yyyy > 2200 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return { ok: false };
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return { ok: false };
  return { ok: true, normalized: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${String(yyyy).padStart(4, "0")}` };
}

function computeOptionsTotalFromPricing(pricing: any): number {
  const p = pricing && typeof pricing === "object" ? pricing : {};
  const excluded = new Set(["total", "cleaning", "tourist_tax", "tax", "taxes", "base", "base_accommodation", "accommodation", "accommodation_total", "subtotal", "nights", "nightly_rate", "rate", "adults", "children", "currency", "options_total"]);
  const direct = Number((p as any).options_total);
  if (Number.isFinite(direct)) return round2(direct);
  let sum = 0;
  for (const [k, v] of Object.entries(p)) {
    if (excluded.has(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) sum += n;
  }
  return round2(sum);
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const OTP_WINDOW_SEC = 10 * 60;
function otpSecret(): string {
  return String(BOOKING_MODERATION_SECRET || "").trim() || "MISSING_BOOKING_MODERATION_SECRET";
}
function otpWindow(nowSec: number) { return Math.floor(nowSec / OTP_WINDOW_SEC); }

function computeOtpCode(args: { rid: string; email: string; window: number }) {
  const h = crypto.createHmac("sha256", otpSecret());
  h.update(`${args.rid}.${String(args.email || "").toLowerCase().trim()}.${args.window}`);
  const digest = h.digest();
  const n = digest.readUInt32BE(0);
  return String(n % 1_000_000).padStart(6, "0");
}

function verifyOtpCode(args: { rid: string; email: string; code: string }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const w = otpWindow(nowSec);
  const cleaned = String(args.code || "").replace(/\D/g, "").slice(0, 6);
  if (cleaned.length !== 6) return false;
  return cleaned === computeOtpCode({ rid: args.rid, email: args.email, window: w }) || cleaned === computeOtpCode({ rid: args.rid, email: args.email, window: w - 1 });
}

function signTransferLink(args: { rid: string; email: string; token: string }) {
  const h = crypto.createHmac("sha256", otpSecret());
  h.update(`transfer.${args.rid}.${String(args.email || "").toLowerCase().trim()}.${args.token}`);
  return h.digest("hex").slice(0, 32);
}

function verifyTransferLink(args: { rid: string; email: string; token: string; k: string }) {
  return String(args.k || "") === signTransferLink({ rid: args.rid, email: args.email, token: args.token });
}

function baseUrl() { return SITE_URL ? SITE_URL.replace(/\/$/, "") : ""; }

/**
 * ANNEXE 3 : RÈGLEMENT INTÉRIEUR COMPLET (Injecté depuis ta demande)
 */
const ANNEXE3_TEXT = `▶️ Le GPS ne trouvant pas la villa en pleine forêt, nous vous donnons rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée afin qu’une personne vienne vous chercher et vous guide jusqu’à la propriété.
▶️ Suite à de nombreuses mauvaises expériences, abus, vols et dégradations, nous sommes dans l'obligation de demander la validation de ce règlement avant toute location. Un état des lieux avec signature sera effectué à l’arrivée et au départ afin de prévenir toute disparition ou détérioration :
⛔️ Fêtes strictement interdites : tout non-respect entraînera une expulsion immédiate via la plateforme ou la police
‼️ Nombre de personnes limité à 8. Pour toute personne supplémentaire, un supplément de 50 €/personne/nuit sera demandé à l’arrivée ainsi que 50 €/personne supplémentaire en journée (même si elle ne dort pas sur place)
🚻 Personnes non déclarées interdites : toute personne supplémentaire doit être signalée avant la location
🎦 Caméras de surveillance sur l’accès afin d’éviter tout abus
🚼 Les personnes supplémentaires doivent apporter leur propre matelas gonflable et literie.
❌ Les canapés ne sont pas convertibles : il est interdit d’y dormir
🛏️ Merci de NE PAS enlever la literie des lits avant votre départ. Toute disparition sera facturée en raison des nombreux vols constatés
❌ Ne pas retirer les tapis noir du four pendant les cuissons, ne pas les jeter.
🚭 Non-fumeurs à l’intérieur : merci d’utiliser un cendrier en extérieur et de ne jeter aucun mégot au sol (risque d’incendie élevé et non-respect du lieu naturel)
🚮 Poubelles : à emporter à votre départ
🍽️ Vaisselle : à placer dans le lave-vaisselle avant de partir (ne pas laisser dans l’évier)
✅ Linge fourni : literies, couvertures supplémentaires et serviettes de douche (grandes et petites). Literie bébé non fournis. Serviettes de piscine non fournies
📛 Zones privées interdites : toute zone non visitée avec la propriétaire est strictement interdite d’accès dont l’enclos des chats.
🏊‍♀️ Accès interdit au local technique de la piscine. Ne pas manipuler la pompe ni les vannes. Un tuyau est à disposition pour compenser l’évaporation de l’eau en été
❌ Ne pas démonter ni ouvrir ni arracher l’alarme de la piscine : un règlement est fourni sur la porte du local technique pour son utilisation.
🔥 Sécurité incendie : feux d’artifice, pétards et fumigènes interdits
🍗 Barbecue autorisé sauf par vent fort : charbon non fourni. Merci de laisser le barbecue propre et de vider les cendres froides dans un sac poubelle (ne pas jeter dans le jardin).
🐶 Animaux acceptés avec supplément de 10 euros par chien et par nuit à payer à votre arrivée
✅ Produits fournis : savon, shampoing, cafetière à filtre (café moulu), filtres, éponge, torchon, produits ménagers, papier toilette, sel, poivre, sucre, produit vaisselle, pastilles lave-vaisselle, sopalin
🚰 Prévoir des packs d’eau potable (eau du forage). 🫧 Lessive non fournie
🕯️ Poêle à bois en option : 40 € (1/4 de stère + sac bois d’allumage + allume-feu). À réserver avant l’arrivée.
🛣️ Route d’accès : piste en terre sur 2 minutes, déconseillée aux voitures très basses.
📍 Arrivée entre 16h et 18h (possibilité en début de journée avec supplément de 70 €, selon disponibilités).
📍 Départ à 10h maximum avec check-out obligatoire. La maison doit être libre et vide des locataires et de leurs bagages à 10h au plus tard par respect pour les arrivants. Si vous souhaitez partir plus tôt, nous viendrons vérifier la maison. Départ en fin de journée possible avec supplément de 70 € (selon disponibilités).`;

/**
 * RIB : COORDONNÉES BANCAIRES (Injecté depuis ta capture Revolut)
 */
const RIB_TEXT = `COORDONNÉES BANCAIRES POUR LE VIREMENT (ACOMPTE 30%) :
Bénéficiaire : Coralie Laurens
IBAN : FR76 2823 3000 0105 5571 3835 979
BIC : REVOFRP2
Banque : Revolut`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rid = normalizeRid(searchParams.get("rid"));
  const t = searchParams.get("t") || "";
  const action = mustStr(searchParams.get("action") || "");
  const k = mustStr(searchParams.get("k") || "");
  if (!rid) return jsonError("Missing rid", 400);
  const supabase = requireSupabaseAdmin();
  const { data: booking, error } = await supabase.from("booking_requests").select("id, created_at, name, email, phone, start_date, end_date, adults, children, animals_count, message, pricing").eq("id", rid).maybeSingle();
  if (error || !booking) return jsonError("Booking not found", 404);
  const okToken = verifyContractToken({ rid, email: booking.email, secret: BOOKING_MODERATION_SECRET, token: t });
  if (!okToken) return jsonError("Invalid token", 403);
  if (action === "transfer_sent") {
    const okK = verifyTransferLink({ rid, email: booking.email, token: t, k });
    if (!okK) return jsonError("Invalid link", 403);
    try { await supabase.from("booking_contracts").update({ transfer_declared_at: new Date().toISOString(), transfer_declared: true } as any).eq("booking_request_id", rid); } catch { }
    const resend = requireResend();
    if (BOOKING_NOTIFY_EMAIL) {
      await resend.emails.send({ from: RESEND_FROM, to: [BOOKING_NOTIFY_EMAIL], replyTo: BOOKING_REPLY_TO || undefined, subject: `Virement déclaré envoyé (30%) — Demande #${rid}`, html: `<p>Le locataire <b>${escapeHtml(booking.name)}</b> a déclaré avoir envoyé le virement de l'acompte pour la demande #${rid}.</p>` });
    }
    return new NextResponse(`<!doctype html><html><body style="font-family:sans-serif;padding:24px;"><h2>Merci ✅</h2><p>Votre confirmation a été enregistrée.</p><p><a href="${baseUrl()}/contract?rid=${rid}&t=${t}">Retour au contrat</a></p></body></html>`, { headers: { "content-type": "text/html" } });
  }
  const { data: contract } = await supabase.from("booking_contracts").select("*").eq("booking_request_id", rid).maybeSingle();
  return NextResponse.json({ ok: true, booking, contract });
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  const action = mustStr(body?.action), rid = normalizeRid(mustStr(body?.rid)), t = mustStr(body?.t);
  if (!rid) return jsonError("Missing rid", 400);
  const supabase = requireSupabaseAdmin();
  const { data: booking } = await supabase.from("booking_requests").select("*").eq("id", rid).maybeSingle();
  if (!booking) return jsonError("Booking not found", 404);
  if (!verifyContractToken({ rid, email: booking.email, secret: BOOKING_MODERATION_SECRET, token: t })) return jsonError("Invalid token", 403);

  const addressLine1 = mustStr(body?.signer_address_line1), postalCode = mustStr(body?.signer_postal_code), city = mustStr(body?.signer_city), country = mustStr(body?.signer_country || "France"), occupants = Array.isArray(body?.occupants) ? body.occupants : [], acceptedTerms = Boolean(body?.accepted_terms);
  const parsedDate = parseContractDateFR(mustStr(body?.contract_date));
  if (!parsedDate.ok) return jsonError("Date de contrat invalide (JJ/MM/AAAA).", 400);

  const normOccupants = occupants.map((o: any) => ({ first_name: mustStr(o?.first_name), last_name: mustStr(o?.last_name), age: mustStr(o?.age) })).filter(o => o.first_name && o.last_name);
  if (!addressLine1 || !postalCode || !city || !acceptedTerms || normOccupants.length === 0) return jsonError("Formulaire incomplet.", 400);

  await supabase.from("booking_contracts").upsert({ booking_request_id: rid, signer_address_line1: addressLine1, signer_postal_code: postalCode, signer_city: city, signer_country: country, occupants: normOccupants, contract_date: parsedDate.normalized, ip: req.headers.get("x-forwarded-for"), user_agent: req.headers.get("user-agent") } as any, { onConflict: "booking_request_id" });

  const p = booking.pricing || {}, total = pickNumber(p, ["total"]) || 0, deposit30 = round2(total * 0.3), solde = round2(total - deposit30);

  if (action === "send_otp") {
    const resend = requireResend(), code = computeOtpCode({ rid, email: booking.email, window: otpWindow(Math.floor(Date.now() / 1000)) });
    await resend.emails.send({ from: RESEND_FROM, to: [booking.email], subject: "Code de signature électronique (6 chiffres)", html: `<div style="font-family:sans-serif;"><h2>Votre code : ${code}</h2><p>Saisissez ce code sur le site pour signer votre contrat.</p></div>` });
    return NextResponse.json({ ok: true, otp_sent: true });
  }

  if (action === "verify_otp") {
    if (!verifyOtpCode({ rid, email: booking.email, code: mustStr(body?.otp_code) })) return jsonError("Code invalide.", 400);
    await supabase.from("booking_contracts").update({ signed_at: new Date().toISOString() } as any).eq("booking_request_id", rid);
    const resend = requireResend(), transferUrl = `${baseUrl()}/api/contract?rid=${rid}&t=${t}&action=transfer_sent&k=${signTransferLink({ rid, email: booking.email, token: t })}`;
    await resend.emails.send({
      from: RESEND_FROM, to: [booking.email], subject: "Contrat signé ✅ — Paiement de l’acompte (30%)",
      html: `<div style="font-family:sans-serif;"><h2>Merci ! Votre contrat est signé ✅</h2><p>Total : ${toMoneyEUR(total)} | Acompte (30%) : <b>${toMoneyEUR(deposit30)}</b></p><p><b>RIB</b></p><pre style="background:#f6f6f6;padding:12px;">${escapeHtml(RIB_TEXT)}</pre><p><a href="${transferUrl}" style="background:#0f172a;color:#fff;padding:10px;text-decoration:none;border-radius:5px;">J’ai bien envoyé le virement des 30%</a></p><hr/><pre style="font-size:12px;">${escapeHtml(ANNEXE3_TEXT)}</pre></div>`
    });
    if (BOOKING_NOTIFY_EMAIL) {
      await resend.emails.send({ from: RESEND_FROM, to: [BOOKING_NOTIFY_EMAIL], subject: `Contrat signé — Demande #${rid}`, html: `<p>Le locataire <b>${booking.name}</b> a signé le contrat. <a href="${baseUrl()}/contract?rid=${rid}&t=${t}">Voir le contrat</a></p>` });
    }
    return NextResponse.json({ ok: true, signed: true, deposit30 });
  }

  return NextResponse.json({ ok: true, saved: true, deposit30 });
}