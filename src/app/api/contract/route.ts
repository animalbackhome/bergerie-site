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

// ✅ Date contrat (JJ/MM/AAAA) : validation stricte + date réelle (pas 31/02)
function parseContractDateFR(
  input: string
): { ok: true; normalized: string } | { ok: false } {
  const s = mustStr(input);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return { ok: false };

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return { ok: false };
  if (yyyy < 1900 || yyyy > 2200) return { ok: false };
  if (mm < 1 || mm > 12) return { ok: false };
  if (dd < 1 || dd > 31) return { ok: false };

  // validation calendrier réelle
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return { ok: false };
  }

  const normalized = `${String(dd).padStart(2, "0")}/${String(mm).padStart(
    2,
    "0"
  )}/${String(yyyy).padStart(4, "0")}`;

  return { ok: true, normalized };
}

// ✅ RIB FIXE (pop-up + emails + contrat)
const BANK_DETAILS = {
  beneficiary: "Coralie Laurens",
  iban: "FR76 2823 3000 0105 5571 3835 979",
  bic: "REVOFRP2",
};

/**
 * ✅ Options éventuelles :
 * - si options_total existe (ou alias) -> on l’utilise (source de vérité)
 * - sinon : somme des champs numériques "options" existants,
 *   en excluant les postes non-options (total, base, ménage, taxe, etc.)
 */
function computeOptionsTotalFromPricing(pricing: any): number {
  const p = pricing && typeof pricing === "object" ? pricing : {};

  const direct =
    pickNumber(p, ["options_total", "extras_total", "addon_total", "add_ons_total"]) ?? null;
  if (direct != null) return round2(direct);

  const excluded = new Set<string>([
    "currency",

    // totals
    "total",
    "total_price",
    "grand_total",
    "amount_total",

    // base / accommodation
    "base_accommodation",
    "base",
    "base_total",
    "accommodation",
    "accommodation_total",
    "stay",
    "stay_total",
    "lodging",
    "lodging_total",

    // cleaning
    "cleaning",
    "cleaning_fee",
    "cleaningFee",
    "menage",

    // tax
    "tourist_tax",
    "taxe_sejour",
    "taxe_de_sejour",
    "city_tax",
    "local_tax",
    "tax",
    "taxes",

    // other non-option metadata
    "subtotal",
    "nights",
    "nightly_rate",
    "rate",
    "adults",
    "children",

    // avoid double count if present
    "options_total",
    "extras_total",
    "addon_total",
    "add_ons_total",
    "extras",
    "options",
  ]);

  let sum = 0;
  for (const [k, v] of Object.entries(p)) {
    if (excluded.has(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
  }

  return round2(sum);
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

  arrivalYmd: string;
  departureYmd: string;

  totalN: number | null;
  accommodationN: number | null;
  cleaningN: number; // fixe: 100
  optionsN: number;
  touristTaxN: number;
  deposit30N: number | null;
  soldeN: number | null;

  address: string;
  occupantsText: string;

  signatureDate: string; // ✅ date SAISIE par le locataire (JJ/MM/AAAA)

  bankBeneficiary: string;
  bankIban: string;
  bankBic: string;
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
    arrivalYmd,
    departureYmd,
    totalN,
    accommodationN,
    cleaningN,
    optionsN,
    touristTaxN,
    deposit30N,
    soldeN,
    address,
    occupantsText,
    signatureDate,
    bankBeneficiary,
    bankIban,
    bankBic,
  } = args;

  const nights = nightsBetween(arrivalYmd, departureYmd);

  const totalPrice = totalN != null ? toMoneyEUR(totalN) : "";
  const accommodation = accommodationN != null ? toMoneyEUR(accommodationN) : "";
  const cleaning = toMoneyEUR(cleaningN);
  const options = toMoneyEUR(optionsN);
  const touristTax = toMoneyEUR(touristTaxN);
  const deposit30 = deposit30N != null ? toMoneyEUR(deposit30N) : "";
  const solde = soldeN != null ? toMoneyEUR(soldeN) : "";

  return `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS —

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : ${ownerName}
Adresse : ${ownerAddress}
E-mail : ${ownerEmail}
Téléphone : ${ownerPhone}

Locataire
Nom / Prénom : ${fullName || "[]"}
Adresse : ${address || "[Adresse à compléter]"}
E-mail : ${email || "[]"}
Téléphone : ${phone || "[]"}

Le locataire déclare être majeur et avoir la capacité de contracter.

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : ${propertyAddress}
Capacité maximale : 8 personnes (voir Article 11).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

Annexes (faisant partie intégrante du contrat) :
Annexe 1 : État descriptif du logement (repris du site)
Annexe 2 : Inventaire / liste équipements (repris du site)
Annexe 3 : Règlement intérieur (repris et signé)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)

3) Durée — Dates — Horaires
Période : du ${formatDateFR(arrivalYmd)} au ${formatDateFR(departureYmd)} pour ${nights} nuits.
Horaires standard
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)
Options (si accord préalable et selon disponibilités) :
Arrivée début de journée : +70€
Départ fin de journée : +70€

4) Prix — Taxes — Prestations
Prix total du séjour : ${totalPrice || "[____ €]"} comprenant :
Hébergement : ${accommodation || "[____ €]"}
Forfait ménage : ${cleaning || "100€"}
Options éventuelles : ${options || "[____ €]"}
Taxe de séjour : ${touristTax || "[____ €]"} (si applicable / selon règles locales)

5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)
Mode de paiement : virement bancaire uniquement.
Aucun paiement par chèque n’est accepté.

RIB (virement bancaire)
Bénéficiaire : ${bankBeneficiary}
IBAN : ${bankIban}
BIC : ${bankBic}

5.1 Acompte (30%)
Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit ${deposit30 || "[____ €]"}.
✅ Les parties conviennent expressément que la somme versée à la réservation constitue un ACOMPTE et non des arrhes.

5.2 Solde
Le solde, soit ${solde || "[____ €]"}, doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.
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
Aucune des parties ne pourra être tenue responsable si l’exécution du contrat est empêché par un événement répondant à la définition de la force majeure (événement échappant au contrôle, imprévisible et irrésistible).

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
Fait à Carcès, le ${signatureDate || "[date]"}
En 2 exemplaires.
Le Propriétaire (signature précédée de la mention “Lu et approuvé”) :
[____________________]
Le Locataire (signature précédée de la mention “Lu et approuvé”) :
[____________________]

ANNEXE 1 — ÉTAT DESCRIPTIF DU LOGEMENT

- Logement entier (bergerie)
- Capacité : 8 personnes
- Extérieurs : jardin / terrasse, espace repas extérieur, barbecue/plancha, transats
- Piscine privée (avec alarme) + petit bassin naturel
- Stationnement gratuit sur place (parking)
- Accès : arrivée autonome possible (selon modalités), accès par chemin privé
- Connexion Internet : Starlink (maxi vitesse par satellite)
- Chauffage : poêle à bois + chauffage
- Sécurité : détecteur de fumée, détecteur de monoxyde de carbone, extincteur

ANNEXE 2 — INVENTAIRE / LISTE ÉQUIPEMENTS

SALLE DE BAIN
- 2 sèche-cheveux
- 2 douches à l’italienne
- Machine à laver
- Produits de nettoyage
- Shampooing, savon pour le corps, gel douche
- Eau chaude

CHAMBRE & LINGE
- Équipements de base (serviettes, draps, savon, papier toilette)
- Grand dressing, cintres
- Draps, couettes, couvertures supplémentaires
- 4 oreillers par lit + traversins
- Tables de nuit, lampes de chevet, stores
- Fer à repasser, étendoir à linge, moustiquaire
- Espace de rangement pour vêtements

CUISINE & REPAS
- Cuisine équipée : plaque de cuisson, four, micro-ondes, réfrigérateur, congélateur
- Lave-vaisselle
- Ustensiles de cuisine, casseroles, poêles
- Vaisselle, verres, couverts
- Cafetière à filtre

EXTÉRIEUR
- Mobilier extérieur (table/chaises), transats
- Barbecue / plancha

ANNEXE 3 — RÈGLEMENT INTÉRIEUR (à signer)

Informations importantes à lire avant signature du contrat
(merci de lire attentivement et de valider ces points)
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


Signature du locataire (Annexe 3 — “Lu et approuvé”) :
[____________________]

ANNEXE 4 — ÉTAT DES LIEUX D’ENTRÉE / SORTIE
(À signer sur place.)

✅ Structure du contrat
Le contrat est structuré en articles + annexes, pour être lisible et juridiquement solide.

—
Personnes présentes pendant la location (nom, prénom, âge)
${occupantsText}
`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rid = normalizeRid(searchParams.get("rid"));
  const t = searchParams.get("t") || "";

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

  // ✅ NOUVEAU : date du contrat obligatoire (JJ/MM/AAAA)
  const contractDateRaw = mustStr(body?.contract_date);
  const parsedContractDate = parseContractDateFR(contractDateRaw);
  if (!parsedContractDate.ok) {
    return jsonError("Merci de renseigner la date du contrat au format JJ/MM/AAAA.", 400);
  }
  const contractDate = parsedContractDate.normalized;

  if (!addressLine1 || !postalCode || !city || !country) {
    return jsonError("Adresse incomplète.", 400);
  }
  if (!acceptedTerms) {
    return jsonError("Vous devez accepter le contrat.", 400);
  }

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
  if (normOccupants.length > 8) {
    return jsonError("Maximum 8 personnes.", 400);
  }

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

        // ✅ NOUVEAU : sauvegarde en base
        contract_date: contractDate,

        ip: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      },
      { onConflict: "booking_request_id" }
    )
    .select(
      "id, booking_request_id, signed_at, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants, contract_date"
    )
    .single();

  if (upErr) return jsonError(upErr.message, 500);

  // ✅ Email : contrat complet avec montants auto-remplis
  const resend = requireResend();
  const baseUrl = SITE_URL ? SITE_URL.replace(/\/$/, "") : "";
  const contractUrl = baseUrl ? `${baseUrl}/contract?rid=${rid}&t=${encodeURIComponent(t)}` : "";

  const arrivalYmd = String(booking.start_date || "").trim();
  const departureYmd = String(booking.end_date || "").trim();

  const p = booking?.pricing || {};

  // ✅ Source de vérité : total si présent
  const totalN = pickNumber(p, ["total", "total_price", "grand_total", "amount_total"]) ?? null;

  // ✅ Forfait ménage fixe : 100€
  const cleaningN = 100;

  // ✅ Taxe de séjour si présente
  const touristTaxN =
    pickNumber(p, ["tourist_tax", "taxe_sejour", "taxe_de_sejour", "city_tax", "local_tax"]) ?? 0;

  // ✅ Options : conforme à la règle anti-double comptage
  const optionsN = computeOptionsTotalFromPricing(p);

  // ✅ Hébergement : champ direct si présent, sinon déduit du total (si total présent)
  let accommodationN =
    pickNumber(p, [
      "base_accommodation",
      "base",
      "base_total",
      "accommodation",
      "accommodation_total",
      "stay",
      "stay_total",
      "lodging",
      "lodging_total",
    ]) ?? null;

  if (accommodationN == null && totalN != null) {
    const computed = totalN - cleaningN - optionsN - touristTaxN;
    accommodationN = Number.isFinite(computed) && computed >= 0 ? round2(computed) : null;
  }

  // ✅ Acompte / solde depuis total (si total présent)
  const deposit30N = totalN != null ? round2(totalN * 0.3) : null;
  const soldeN = totalN != null && deposit30N != null ? round2(totalN - deposit30N) : null;

  const addressText = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${postalCode} ${city}, ${country}`;

  const occupantsText = normOccupants
    .map((o: any) => `- ${o.first_name} ${o.last_name} (${o.age} ans)`)
    .join("\n");

  // ✅ Propriétaire & adresse logement FIXES (non dynamiques)
  const ownerName = "Laurens Coralie";
  const ownerAddress = "2542 chemin des près neufs 83570 Carcès";
  const ownerEmail = "laurens-coralie@hotmail.com";
  const ownerPhone = "0629465295";
  const propertyAddress = "2542 chemin des près neufs 83570 Carcès";

  const contractText = buildFullContractText({
    ownerName,
    ownerAddress,
    ownerEmail,
    ownerPhone,
    propertyAddress,
    fullName: booking.name,
    email: booking.email,
    phone: booking.phone || "",
    arrivalYmd,
    departureYmd,
    totalN,
    accommodationN,
    cleaningN,
    optionsN,
    touristTaxN,
    deposit30N,
    soldeN,
    address: addressText,
    occupantsText,
    // ✅ Date saisie (obligatoire)
    signatureDate: contractDate,

    // ✅ RIB FIXE
    bankBeneficiary: BANK_DETAILS.beneficiary,
    bankIban: BANK_DETAILS.iban,
    bankBic: BANK_DETAILS.bic,
  });

  const subjectOwner = `Contrat signé — Demande #${rid}`;

  const bankHtml = `
    <div style="margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb">
      <div style="font-weight:700;margin-bottom:6px">RIB (virement bancaire)</div>
      <div><b>Bénéficiaire :</b> ${escapeHtml(BANK_DETAILS.beneficiary)}</div>
      <div><b>IBAN :</b> ${escapeHtml(BANK_DETAILS.iban)}</div>
      <div><b>BIC :</b> ${escapeHtml(BANK_DETAILS.bic)}</div>
    </div>
  `;

  const htmlOwner = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
      <h2>${escapeHtml(subjectOwner)}</h2>
      <p><b>Réservant</b> : ${escapeHtml(booking.name)} — ${escapeHtml(booking.email)} — ${escapeHtml(booking.phone || "")}</p>
      <p><b>Dates</b> : ${escapeHtml(formatDateFR(arrivalYmd))} → ${escapeHtml(formatDateFR(departureYmd))} (${nightsBetween(arrivalYmd, departureYmd)} nuit(s))</p>
      ${totalN != null ? `<p><b>Total</b> : ${escapeHtml(toMoneyEUR(totalN))}</p>` : ""}
      <p><b>Adresse</b> : ${escapeHtml(addressText)}</p>
      <p><b>Personnes présentes</b> :<br/>${escapeHtml(occupantsText).replace(/\n/g, "<br/>")}</p>
      ${bankHtml}
      ${contractUrl ? `<p><a href="${contractUrl}">Voir le contrat en ligne</a></p>` : ""}
      <hr/>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
    </div>
  `;

  const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];

  if (recipientsOwner.length) {
    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientsOwner,
      replyTo: BOOKING_REPLY_TO || undefined,
      subject: subjectOwner,
      html: htmlOwner,
    });
  }

  await resend.emails.send({
    from: RESEND_FROM,
    to: [booking.email],
    replyTo: BOOKING_REPLY_TO || undefined,
    subject: "Votre contrat est signé ✅",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
        <h2>Merci ! Votre contrat est signé ✅</h2>
        <p>Vous pouvez conserver ce message comme preuve.</p>
        ${bankHtml}
        ${contractUrl ? `<p><a href="${contractUrl}">Revoir le contrat en ligne</a></p>` : ""}
        <hr/>
        <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
        <p style="margin-top:16px">Très cordialement<br/>Laurens Coralie</p>
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
