import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from 'resend';
import crypto from "crypto";

// CONFIGURATION DIRECTE (On garde tes réglages actuels)
const RESEND_DIRECT = new Resend("re_CkEh3sP1_3BBsV9w6tXFgBrXnxC4MU9NN");
const FROM_EMAIL = "Laurens Coralie <contact@superbe-bergerie-foret-piscine-lac.com>";
const OWNER_EMAIL = "laurens-coralie@hotmail.com";
const MODERATION_SECRET = "86b65988bbaa5ddf30c4c71058ad300d1961ed5889ebc01a777165f9d3175c01";

// TON RIB ACTUEL (Je n'y touche pas)
const RIB_TEXT = `COORDONNÉES BANCAIRES (ACOMPTE 30%) :
Bénéficiaire : Coralie Laurens
IBAN : FR76 2823 3000 0105 5571 3835 979
BIC : REVOFRP2
Banque : Revolut`;

// LE TEXTE COMPLET DE L'ANNEXE 3 (Mis à jour selon ta demande)
const ANNEXE3_TEXT = `ANNEXE 3 - RÈGLEMENT INTÉRIEUR & ACCÈS

Ce sera un plaisir de vous accueillir 😀
▶️ Le GPS ne trouvant pas la villa en pleine forêt, nous vous donnons rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée afin qu’une personne vienne vous chercher et vous guide jusqu’à la propriété.
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
📍 Départ à 10h maximum avec check-out obligatoire. La maison doit être libre et vide des locataires et de leurs bagages à 10h au plus tard par respect pour les arrivants. Si vous souhaitez partir plus tôt, nous viendrons vérifier la maison. Départ en fin de journée possible avec supplément de 70 € (selon disponibilités).

Pour toutes questions vous pouvez me joindre par mail ou par téléphone au 0629465295, très Cordialement, Laurens Coralie.`;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) { return String(v ?? "").trim(); }

/** OTP LOGIC (Inchangé) **/
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
  
  // Note: On peut aussi récupérer le token 't' si besoin, mais ici on focus sur l'action.

  if (!rid) return jsonError("ID manquant", 400);
  const supabase = requireSupabaseAdmin();
  const { data: booking } = await supabase.from("booking_requests").select("*").eq("id", rid).maybeSingle();
  if (!booking) return jsonError("Réservation non trouvée", 404);

  // --- ACTION 1 : ENVOI DU CODE OTP ---
  if (action === "send_otp") {
    const code = computeOtpCode({ rid, email: booking.email, window: otpWindow(Math.floor(Date.now() / 1000)) });
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [booking.email],
      subject: "Votre code de signature - Superbe Bergerie",
      html: `<div style="font-family:sans-serif;">
              <h2>Votre code de signature : <span style="color:#166534; font-size:24px;">${code}</span></h2>
              <p>Saisissez ce code pour signer électroniquement votre contrat.</p>
             </div>`
    });
    return NextResponse.json({ ok: true, otp_sent: true });
  }

  // --- ACTION 2 : VÉRIFICATION ET SIGNATURE ---
  if (action === "verify_otp") {
    if (!verifyOtpCode({ rid, email: booking.email, code: mustStr(body?.otp_code) })) {
      return jsonError("Code incorrect", 400);
    }

    // Mise à jour Supabase
    await supabase.from("booking_contracts").update({ signed_at: new Date().toISOString() } as any).eq("booking_request_id", rid);
    
    // Calcul Acompte
    const total = booking.pricing?.total || 0;
    const deposit30 = Math.round(total * 0.3 * 100) / 100;

    // Email au client (Design mis à jour avec Annexe 3 complète)
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [booking.email],
      subject: "✅ Votre Contrat de Location Signé - Bergerie Carcès",
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto;">
        <h1 style="color: #166534;">Contrat Signé avec Succès</h1>
        <p>Bonjour,</p>
        <p>Votre contrat est bien signé. Le propriétaire va le recevoir dans les plus brefs délais et vous le renverra contresigné si toutes les informations sont correctes.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #166534; margin: 20px 0;">
          <h2 style="color: #166534; margin-top: 0;">Règlement de l'acompte (30%)</h2>
          <p>Afin de valider définitivement votre séjour, merci de procéder au virement de <strong>${deposit30} €</strong>.</p>
          <p><strong>RIB / Coordonnées Bancaires :</strong></p>
          <pre style="font-family: monospace; background: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">${RIB_TEXT}</pre>
          <p style="font-size: 12px; color: #666;">(Merci d'indiquer votre nom et dates de séjour en libellé du virement)</p>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

        <div style="white-space: pre-wrap; line-height: 1.5; color: #444; font-size: 13px;">
          ${ANNEXE3_TEXT}
        </div>
      </div>`
    });

    // Notification pour le propriétaire
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      subject: `CONTRAT SIGNÉ - Demande #${rid}`,
      html: `<p>Le locataire <strong>${booking.name || booking.email}</strong> vient de signer son contrat électroniquement.</p>`
    });

    return NextResponse.json({ ok: true, signed: true, deposit30 });
  }

  // --- ACTION 3 : ALERTE PAIEMENT (Nouvelle action) ---
  if (action === "payment_alert") {
    const montant = body?.montant || "N/A";
    
    // Notification pour le propriétaire
    await RESEND_DIRECT.emails.send({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      subject: `💰 Virement effectué par ${booking.name || "Client"}`,
      html: `
        <h1>Nouveau paiement signalé !</h1>
        <p>Le client <strong>${booking.name || booking.email}</strong> a signé le contrat et a coché la case indiquant qu'il a effectué le virement de l'acompte.</p>
        <div style="background: #e0f2fe; padding: 15px; border-radius: 5px; color: #0369a1; font-weight: bold;">
            Montant attendu : ${montant} €
        </div>
        <p>Pense à vérifier ton compte Revolut dans les prochains jours.</p>
      `
    });
    
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}