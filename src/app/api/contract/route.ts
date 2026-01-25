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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s;
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

  // UUID rid (Supabase uuid)
  if (__isUuid(s)) return s;

  // Numeric rid (legacy / optional)
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

function buildFullContractText(args: {
  ownerName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhone: string;
  propertyAddress: string;

  fullName: string;
  email: string;
  phone: string;

  arrivalDate: string; // FR
  departureDate: string; // FR
  nights: number;

  totalPrice: string; // "xxx €" or ""
  deposit30: string; // "xxx €" or ""
  address: string;
  occupantsText: string;
}) {
  const {
    ownerName,
    ownerAddress,
    ownerEmail,
    ownerPhone,
    propertyAddress,
    fullName,
    email,
    phone,
    arrivalDate,
    departureDate,
    nights,
    totalPrice,
    deposit30,
    address,
    occupantsText,
  } = args;

  // IMPORTANT: texte complet (contrat + annexes) sans suppression.
  return `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS —

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : ${ownerName || "[]"}
Adresse : ${ownerAddress || "[]"}
E-mail : ${ownerEmail || "[]"}
Téléphone : ${ownerPhone || "[]"}

Locataire
Nom / Prénom : ${fullName || "[]"}
Adresse : ${address || "[]"}
E-mail : ${email || "[]"}
Téléphone : ${phone || "[]"}

Le locataire déclare être majeur et avoir la capacité de contracter.

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : ${propertyAddress || "[____________________]"}
Capacité maximale : 8 personnes (voir Article 11).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

Annexes (faisant partie intégrante du contrat) :
Annexe 1 : État descriptif du logement (repris du site)
Annexe 2 : Inventaire / liste équipements (repris du site)
Annexe 3 : Règlement intérieur (repris et signé)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)

3) Durée — Dates — Horaires
Période : du ${arrivalDate} au ${departureDate} pour ${nights} nuits.
Horaires standard (selon ton site)
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)
Options (si accord préalable et selon disponibilités) :
Arrivée début de journée : +70€
Départ fin de journée : +70€

4) Prix — Taxes — Prestations
Prix total du séjour : ${totalPrice || "[____ €]"} comprenant :
Hébergement : [____ €]
Forfait ménage : 100€
Options éventuelles : [____ €]
Taxe de séjour : [____ €] (si applicable / selon règles locales)

5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)
Mode de paiement : virement bancaire uniquement.
Aucun paiement par chèque n’est accepté.

5.1 Acompte (30%)
Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit ${deposit30 || "[____ €]"}.
✅ Les parties conviennent expressément que la somme versée à la réservation constitue un ACOMPTE et non des arrhes.

5.2 Solde
Le solde, soit [____ €], doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.
À défaut de paiement du solde dans ce délai, et sans réponse dans les 48h suivant l’e-mail de relance, le propriétaire pourra considérer la réservation comme annulée par le locataire, l’acompte restant acquis au propriétaire.

6) Formation du contrat — Réservation
La réservation devient effective dès réception :
du présent contrat signé, et
de l’acompte de 30%.
Le solde reste exigible selon l’Article 5.2.

7) Absence de droit de rétractation
Le locataire est informé que, pour une prestation d’hébergement fournie à une date déterminée, il ne bénéficie pas d’un droit de rétractation.
➡️ Les conditions d’annulation applicables sont celles prévues à l’Article 8.

8) Annulation / Non-présentation / Séjour écourté
8.1 Annulation par le locataire
Toute annulation doit être notifiée par écrit (e-mail + recommandé conseillé).
a) Quel que soit le motif, l’acompte de 30% reste définitivement acquis au propriétaire.
b) À compter du paiement du solde (J-7 avant l’arrivée), aucun remboursement ne sera effectué, quel que soit le motif d’annulation ou d’empêchement, et le locataire reste redevable de la totalité du séjour.
c) Si le séjour est écourté, aucun remboursement n’est dû.

8.2 Non-présentation (“no-show”)
Si le locataire ne se manifeste pas et n’a pas convenu d’une arrivée différée :
à partir de minuit (00h00) le jour d’arrivée, l’entrée dans les lieux n’est plus possible ;
si le locataire ne donne aucune nouvelle avant le lendemain 10h, le propriétaire peut considérer la réservation comme annulée, disposer du logement, et conserver les sommes versées (hors taxe de séjour si non due).

9) Annulation par le propriétaire
En cas d’annulation par le propriétaire (hors force majeure), celui-ci remboursera au locataire l’intégralité des sommes effectivement versées dans un délai de 7 jours.
Aucune indemnité forfaitaire supplémentaire n’est due.

10) Force majeure
Aucune des parties ne pourra être tenue responsable si l’exécution du contrat est empêchée par un événement répondant à la définition de la force majeure (événement échappant au contrôle, imprévisible et irrésistible).

11) État des lieux — Ménage — Entretien
Un état des lieux contradictoire est signé à l’arrivée et au départ (Annexe 4).
Le ménage de fin de séjour est assuré par le propriétaire dans la limite d’un usage normal.
Le barbecue/plancha doivent être rendus propres. Les frais de remise en état, nettoyage exceptionnel, ou dégradations peuvent être facturés.

12) Dépôt de garantie (caution) — 500€ (en liquide à l’arrivée)
Un dépôt de garantie de 500€ est demandé en liquide à l’arrivée.
Il est restitué après l’état des lieux de sortie, déduction faite des sommes dues au titre :
dégradations, pertes, casse, nettoyage anormal, non-respect du règlement intérieur.
En cas de retenue, le propriétaire pourra fournir, selon le cas, photos + devis/factures justifiant la retenue.

13) Identité du locataire
À l’arrivée, le locataire s’engage à présenter une pièce d’identité au nom de la personne ayant réservé, uniquement pour vérification d’identité.
Aucun numéro de pièce n’est relevé ni conservé.

14) Capacité — Personnes supplémentaires — Visiteurs
Capacité maximale : 8 personnes.
Toute personne supplémentaire non autorisée peut entraîner la résiliation immédiate sans remboursement.
Supplément : 50€/personne/nuit et 50€/personne en journée (même sans nuitée), selon accord préalable.

15) Animaux
Animaux acceptés selon conditions.
Supplément : 10€ par chien et par nuit (à régler à l’arrivée, sauf indication contraire).
Le locataire s’engage à maintenir la propreté, éviter toute dégradation et ramasser les déjections à l’extérieur.

16) Caméras (information)
Le locataire est informé de la présence de caméras uniquement sur les accès extérieurs (entrée/accès), à des fins de sécurité.
Aucune caméra n’est présente à l’intérieur du logement.

17) Assurance
Le locataire est responsable des dommages survenant de son fait et déclare être couvert par une assurance responsabilité civile villégiature (ou équivalent). Il est conseillé de souscrire une assurance annulation.

18) Utilisation paisible — Règlement intérieur
Le locataire s’engage à une jouissance paisible des lieux et au respect du Règlement intérieur (Annexe 3), dont la validation conditionne la location.

19) Cession / Sous-location
La location ne peut bénéficier à des tiers, sauf accord écrit du propriétaire. Toute infraction peut entraîner résiliation immédiate sans remboursement.

20) Litiges
Contrat entre particuliers. En cas de difficulté, les parties recherchent une solution amiable.
À défaut, le litige relèvera des juridictions compétentes selon les règles de droit commun.

Signatures
Fait à [ville], le [date].
En 2 exemplaires.
Le Propriétaire (signature précédée de la mention “Lu et approuvé”) :
[____________________]
Le Locataire (signature précédée de la mention “Lu et approuvé”) :
[____________________]

ANNEXE 3 — RÈGLEMENT INTÉRIEUR (à signer)
(On colle ici ton règlement complet + signature “Lu et approuvé” du locataire.)

✅ Structure du contrat (version actuelle — “ma base”)
Le contrat est structuré en articles + annexes, pour être lisible et juridiquement solide :
A) Identification des parties
Propriétaire (bailleur) : identité + coordonnées
Locataire : identité + coordonnées
Déclaration de capacité à contracter
B) Désignation de la location
Nature : location saisonnière meublée
Adresse / capacité / usage (résidence de vacances)
C) Durée — Dates — Horaires
Dates du séjour + nombre de nuits
Horaires conformes au site :
arrivée 16h–18h
départ 10h max
options possibles : arrivée début de journée (+70€) / départ fin de journée (+70€) selon disponibilité
D) Prix — Taxes — Prestations
Détail du prix total
Forfait ménage fixe : 100€
Taxe de séjour (si applicable) + options éventuelles
E) Paiement (virement uniquement)
Paiement par RIB uniquement (pas de chèque)
Acompte 30% : qualifié explicitement comme acompte (et non arrhes)
Solde à payer au plus tard 7 jours avant l’arrivée
F) Réservation / engagement
Réservation effective à réception :
contrat signé
acompte payé
Le solde reste exigible selon les délais prévus
G) Pas de droit de rétractation
Mention spécifique à l’hébergement à date déterminée
Renvoi clair aux conditions d’annulation
H) Annulation / No-show / séjour écourté (protection maximale)
Acompte : non remboursable
Après paiement du solde (J-7) : aucun remboursement, quel que soit le motif
No-show : entrée impossible à partir de minuit, règles de disposition du logement ensuite
I) Annulation par le propriétaire
Remboursement intégral des sommes versées
Pas d’indemnité forfaitaire
J) État des lieux / entretien / ménage
État des lieux d’entrée + sortie signé
Conditions ménage + remise en état si abus/dégradations
K) Caution / dépôt de garantie
Caution : 500€ en liquide à l’arrivée
Restitution après état des lieux de sortie
Retenues possibles (dégradations/pertes/ménage anormal), justificatifs possibles (photos + devis/factures si nécessaire)
L) Vérification d’identité
À l’arrivée : présentation d’une pièce d’identité au nom du réservant
Aucun numéro de pièce relevé
M) Capacité / personnes supplémentaires / visiteurs
Max 8 personnes
Surcoûts : 50€/pers/nuit + 50€/visiteur journée (même sans nuitée)
Interdiction personnes non déclarées
N) Animaux
Acceptés sous conditions
Supplément : 10€/chien/nuit (à régler à l’arrivée)
O) Caméras
Présence de caméras uniquement sur les accès extérieurs (information obligatoire)
P) Assurance
Responsabilité civile villégiature conseillée / exigée
Q) Utilisation paisible + règlement intérieur
Respect du règlement intérieur obligatoire
Interdictions et règles détaillées
R) Cession / sous-location
Interdite sans accord écrit
S) Litiges
Recherche d’accord amiable
Compétence selon règles de droit commun

2) Annexes (très important)
Le contrat est complété par des annexes qui font partie intégrante du dossier :
Annexe 1 — État descriptif du logement : informations détaillées (surface, équipements, prestations), pouvant être repris automatiquement depuis le site
Annexe 2 — Inventaire : liste équipements/objets, pouvant aussi être générée depuis la base du site
Annexe 3 — Règlement intérieur : le règlement complet à valider avant location
Annexe 4 — État des lieux d’entrée / sortie : document signé sur place

—
Personnes présentes pendant la location (nom, prénom, âge)
${occupantsText}
`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rid = normalizeRid(searchParams.get("rid"));
  const t = searchParams.get("t");
  if (!rid) return jsonError("Missing rid", 400);

  const supabase = requireSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .select(
      "id, created_at, full_name, email, phone, arrival_date, departure_date, adults_count, children_count, animals_count, message, pricing"
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

  const { data: contract, error: cErr } = await supabase
    .from("booking_contracts")
    .select(
      "id, booking_request_id, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants, signed_at"
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

  const rid = normalizeRid(mustStr(body?.rid));
  const t = mustStr(body?.t);
  if (!rid) return jsonError("Missing rid", 400);

  const addressLine1 = mustStr(body?.signer_address_line1);
  const addressLine2 = mustStr(body?.signer_address_line2);
  const postalCode = mustStr(body?.signer_postal_code);
  const city = mustStr(body?.signer_city);
  const country = mustStr(body?.signer_country);
  const occupants = Array.isArray(body?.occupants) ? body.occupants : [];
  const acceptedTerms = Boolean(body?.accepted_terms);

  if (!addressLine1 || !postalCode || !city || !country) {
    return jsonError("Adresse incomplète.", 400);
  }
  if (!acceptedTerms) {
    return jsonError("Vous devez accepter le contrat.", 400);
  }

  // Validation occupants : {first_name,last_name,age}
  const normOccupants = occupants
    .map((o: any) => ({
      first_name: mustStr(o?.first_name),
      last_name: mustStr(o?.last_name),
      age: mustStr(o?.age),
    }))
    .filter((o: any) => o.first_name && o.last_name && o.age);

  if (normOccupants.length === 0) {
    return jsonError("Ajoutez au moins une personne (nom, prénom, âge).", 400);
  }

  const supabase = requireSupabaseAdmin();

  const { data: booking, error: bookingErr } = await supabase
    .from("booking_requests")
    .select(
      "id, full_name, email, phone, arrival_date, departure_date, adults_count, children_count, pricing, created_at"
    )
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

  // Enforce EXACT people count (adults + children) if present
  const adults = Number(booking.adults_count ?? 0);
  const children = Number(booking.children_count ?? 0);
  const expected = (Number.isFinite(adults) ? adults : 0) + (Number.isFinite(children) ? children : 0);

  if (expected > 0 && normOccupants.length !== expected) {
    return jsonError(`Vous devez renseigner exactement ${expected} personne(s), comme dans votre demande.`, 400);
  }

  // Upsert (IMPORTANT: no accepted_terms column in DB -> remove it)
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
        ip: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      },
      { onConflict: "booking_request_id" }
    )
    .select(
      "id, booking_request_id, signed_at, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants"
    )
    .single();

  if (upErr) return jsonError(upErr.message, 500);

  // Email
  const resend = requireResend();
  const baseUrl = SITE_URL ? SITE_URL.replace(/\/$/, "") : "";
  const contractUrl = baseUrl ? `${baseUrl}/contract?rid=${rid}&t=${encodeURIComponent(t)}` : "";

  const nights = nightsBetween(booking.arrival_date, booking.departure_date);

  const totalPrice = booking?.pricing ? toMoneyEUR(booking.pricing.total ?? booking.pricing.total_price ?? booking.pricing.grand_total ?? booking.pricing.amount_total) : "";
  const deposit30 = totalPrice ? toMoneyEUR((Number((booking.pricing.total ?? booking.pricing.total_price ?? booking.pricing.grand_total ?? booking.pricing.amount_total) || 0) || 0) * 0.3) : "";

  const addressText = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${postalCode} ${city}, ${country}`;
  const occupantsText = normOccupants
    .map((o: any) => `- ${o.first_name} ${o.last_name} (${o.age} ans)`)
    .join("\n");

  // Optional env (owner/property) for email contract text
  const ownerName = process.env.NEXT_PUBLIC_OWNER_NAME || "";
  const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS || "";
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "";
  const ownerPhone = process.env.NEXT_PUBLIC_OWNER_PHONE || "";
  const propertyAddress = process.env.NEXT_PUBLIC_PROPERTY_ADDRESS || "";

  const contractText = buildFullContractText({
    ownerName,
    ownerAddress,
    ownerEmail,
    ownerPhone,
    propertyAddress,
    fullName: booking.full_name,
    email: booking.email,
    phone: booking.phone || "",
    arrivalDate: formatDateFR(booking.arrival_date),
    departureDate: formatDateFR(booking.departure_date),
    nights,
    totalPrice,
    deposit30,
    address: addressText,
    occupantsText,
  });

  const subjectOwner = `Contrat signé — Demande #${rid}`;

  const htmlOwner = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
      <h2>${escapeHtml(subjectOwner)}</h2>
      <p><b>Réservant</b> : ${escapeHtml(booking.full_name)} — ${escapeHtml(booking.email)} — ${escapeHtml(booking.phone || "")}</p>
      <p><b>Dates</b> : ${escapeHtml(formatDateFR(booking.arrival_date))} → ${escapeHtml(formatDateFR(booking.departure_date))} (${nights} nuit(s))</p>
      ${totalPrice ? `<p><b>Total</b> : ${escapeHtml(totalPrice)}</p>` : ""}
      <p><b>Adresse</b> : ${escapeHtml(addressText)}</p>
      <p><b>Personnes présentes</b> :<br/>${escapeHtml(occupantsText).replace(/\n/g, "<br/>")}</p>
      ${contractUrl ? `<p><a href="${contractUrl}">Voir le contrat en ligne</a></p>` : ""}
      <hr/>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
    </div>
  `;

  const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];

  // email au propriétaire (si configuré)
  if (recipientsOwner.length) {
    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientsOwner,
      replyTo: BOOKING_REPLY_TO || undefined,
      subject: subjectOwner,
      html: htmlOwner,
    });
  }

  // email au client
  await resend.emails.send({
    from: RESEND_FROM,
    to: [booking.email],
    replyTo: BOOKING_REPLY_TO || undefined,
    subject: "Votre contrat est signé ✅",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
        <h2>Merci ! Votre contrat est signé ✅</h2>
        <p>Vous pouvez conserver ce message comme preuve.</p>
        ${contractUrl ? `<p><a href="${contractUrl}">Revoir le contrat en ligne</a></p>` : ""}
        <hr/>
        <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
      </div>
    `,
  });

  return NextResponse.json({ ok: true, contract: saved });
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
