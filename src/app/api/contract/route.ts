import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from 'resend';
import { verifyContractToken } from "@/lib/contractToken";
import crypto from "crypto";

// CONFIGURATION DIRECTE POUR ÉVITER LES BUGS VERCEL
const RESEND_DIRECT = new Resend("re_CkEh3sP1_3BBsV9w6tXFgBrXnxC4MU9NN");
const FROM_EMAIL = "Laurens Coralie <contact@superbe-bergerie-foret-piscine-lac.com>";
const OWNER_EMAIL = "laurens-coralie@hotmail.com";
const MODERATION_SECRET = "86b65988bbaa5ddf30c4c71058ad300d1961ed5889ebc01a777165f9d3175c01";

const RIB_TEXT = `COORDONNÉES BANCAIRES (ACOMPTE 30%) :
Bénéficiaire : Coralie Laurens
IBAN : FR76 2823 3000 0105 5571 3835 979
BIC : REVOFRP2
Banque : Revolut`;

const ANNEXE3_TEXT = `RÈGLEMENT INTÉRIEUR COMPLET :
▶️ RDV Chapelle Notre Dame pour guidage (30 min avant).
⛔️ Fêtes strictement interdites (expulsion immédiate).
‼️ Limite 8 personnes (+50€/nuit par personne sup).
🎦 Caméras sur l'accès.
❌ Ne pas retirer les tapis noir du four.
🚭 Non-fumeurs à l'intérieur.
🚮 Poubelles à emporter.
🍽️ Vaisselle au lave-vaisselle avant départ.
🏊‍♀️ Local technique piscine interdit.
🐶 Animaux : +10€/nuit/chien.
📍 Arrivée 16h-18h / Départ 10h.`;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) { return String(v ?? "").trim(); }

/** OTP LOGIC **/
const OTP_WINDOW_SEC = 10 * 60;
function otpWindow(nowSec: number) { return Math.floor(nowSec / OTP_WINDOW_SEC); }

function computeOtpCode(args: { rid: string; email: string; window: number }) {
  const h = crypto.createHmac("sha256", MODERATION_SECRET);
  h.update(`${args.rid}.${String(args.email || "").toLowerCase().trim()}.${args.window}`);
  const digest = h.digest();
  const n = digest.readUInt32BE(0);
  return String(n % 1_000_000).padStart(6, "0");
}

function verifyOtpCode(args: { rid: string; email: string; code: string }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const w = otpWindow(nowSec);
  const cleaned = String(args.code || "").replace(/\D/g, "").slice(0, 6);
  return cleaned === computeOtpCode({ rid: args.rid, email: args.email, window: w }) || 
         cleaned === computeOtpCode({ rid: args.rid, email: args.email, window: w - 1 });
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return jsonError("JSON Invalide", 400); }
  
  const action = mustStr(body?.action);
  const rid = mustStr(body?.rid);
  const t = mustStr(body?.t);

  if (!rid) return jsonError("ID manquant", 400);
  const supabase = requireSupabaseAdmin();
  const { data: booking } = await supabase.from("booking_requests").select("*").eq("id", rid).maybeSingle();
  if (!booking) return jsonError("Réservation non trouvée", 404);

  // ACTION : ENVOI DU CODE
  if (action === "send_otp") {
    const code = computeOtpCode({ rid, email: booking.email, window: otpWindow(Math.floor(Date.now() / 1000)) });
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [booking.email],
      subject: "Votre code de signature - Superbe Bergerie",
      html: `<div style="font-family:sans-serif;"><h2>Votre code : ${code}</h2><p>Saisissez ce code pour signer votre contrat.</p></div>`
    });
    return NextResponse.json({ ok: true, otp_sent: true });
  }

  // ACTION : VÉRIFICATION ET SIGNATURE FINALE
  if (action === "verify_otp") {
    if (!verifyOtpCode({ rid, email: booking.email, code: mustStr(body?.otp_code) })) {
      return jsonError("Code incorrect", 400);
    }

    await supabase.from("booking_contracts").update({ signed_at: new Date().toISOString() } as any).eq("booking_request_id", rid);
    
    const total = booking.pricing?.total || 0;
    const deposit30 = Math.round(total * 0.3 * 100) / 100;

    // Email au client avec RIB et Règlement
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [booking.email],
      subject: "Contrat signé ✅ - Superbe Bergerie",
      html: `<div style="font-family:sans-serif;">
        <h3>Merci, votre contrat est signé !</h3>
        <p>Acompte de 30% à régler : <b>${deposit30} €</b></p>
        <pre style="background:#f4f4f4;padding:10px;">${RIB_TEXT}</pre>
        <hr/>
        <pre style="font-size:11px;">${ANNEXE3_TEXT}</pre>
      </div>`
    });

    // Notification pour Coralie
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      subject: `CONTRAT SIGNÉ - Demande #${rid}`,
      html: `<p>Le locataire ${booking.name} vient de signer son contrat.</p>`
    });

    return NextResponse.json({ ok: true, signed: true, deposit30 });
  }

  return NextResponse.json({ ok: true });
}