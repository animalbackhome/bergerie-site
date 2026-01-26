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

  const normalized = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${String(yyyy).padStart(
    4,
    "0"
  )}`;

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
    "currency",
    "total",
    "total_price",
    "grand_total",
    "amount_total",
    "base_accommodation",
    "base",
    "base_total",
    "accommodation",
    "accommodation_total",
    "stay",
    "stay_total",
    "lodging",
    "lodging_total",
    "cleaning",
    "cleaning_fee",
    "cleaningFee",
    "menage",
    "tourist_tax",
    "taxe_sejour",
    "taxe_de_sejour",
    "city_tax",
    "local_tax",
    // éviter double comptage
    "options_total",
    "extras_total",
    "extras",
    "options",
    "addon_total",
    "add_ons_total",
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

// ✅ Annexes (repris du site) — insérés dans le mail PDF-like (texte)
const ANNEXE_1 = `(État descriptif du logement — repris du site)

- Logement entier (bergerie)
- Capacité : 8 personnes
- Extérieurs : jardin / terrasse, espace repas extérieur, barbecue/plancha, transats
- Piscine privée (avec alarme) + petit bassin naturel
- Stationnement gratuit sur place (parking)
- Accès : arrivée autonome possible (selon modalités), accès par chemin privé
- Connexion Internet : Starlink (maxi vitesse par satellite)
- Chauffage : poêle à bois + chauffage
- Sécurité : détecteur de fumée, détecteur de monoxyde de carbone, extincteur`;
const ANNEXE_2 = `(Inventaire / équipements — repris du site)

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
- Vaisselle et couverts
- Cafetière, bouilloire, grille-pain
- Verres à vin / flûtes, etc.

DIVERTISSEMENT
- Télévision (chaînes + Netflix + jeux vidéos)
- Livres & de quoi lire
- Jeux extérieurs/intérieurs pour enfants
- Terrain de boules, badminton, panier de basket
- Jeux aquatiques
- Piscine

FAMILLE
- Lit pour bébé + lit parapluie
- Chaise haute
- Salle de jeux pour enfants
- Aire de jeux extérieure
- Pare-feu pour le poêle
- Alarme de sécurité pour piscine

RANDONNÉES / NATURE
- Accès proche : lac, rivière, cascades, canal, forêt

JEUX POUR ADULTES
- Jeux de société, cartes, etc.`;
const ANNEXE_3 = `(Règlement intérieur — repris du site)

RESPECT DU LIEU
- Maison non-fumeur (possible en extérieur uniquement).
- Fêtes et enterrements de vie de jeune fille / garçon non acceptés.
- Nombre de voyageurs : 8 personnes et plus sur demande avec supplément.
- Pas de visiteurs extérieurs sans accord.

PISCINE
- Enfants sous surveillance obligatoire (piscine non clôturée avec alarme de sécurité).
- Interdit de plonger (profondeur variable).
- Merci de se rincer avant baignade (crème/huile).

ANIMAUX
- Animaux acceptés uniquement sur demande (à préciser avant réservation), sans limite de nombre et reminder : supplément.
- Merci de ramasser les excréments et de respecter l’intérieur (poils / boue / griffes sur canapé/lits...).

MÉNAGE / LINGE
- La maison doit être rendue “correcte” (vaisselle, poubelles, etc.).
- Serviettes fournies : merci de ne pas les utiliser pour l’extérieur / piscine.`;

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
Annexe 1 : État descriptif du logement
Annexe 2 : Inventaire / liste équipements
Annexe 3 : Règlement intérieur (à signer)
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
Taxe de séjour : ${touristTax || "[____ €]"}

5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)
Mode de paiement : virement bancaire uniquement.
Aucun paiement par chèque n’est accepté.

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

8) Annulation / Non-présentation / Séjour écourté
8.1 Annulation par le locataire
Toute annulation doit être notifiée par écrit (e-mail + recommandé conseillé).
a) Quel que soit le motif, l’acompte de 30% reste définitivement acquis au propriétaire.
b) À compter du paiement du solde (J-7 avant l’arrivée), aucun remboursement ne sera effectué.
c) Si le séjour est écourté, aucun remboursement n’est dû.

8.2 Non-présentation (“no-show”)
Si le locataire ne se manifeste pas :
à partir de minuit (00h00) le jour d’arrivée, l’entrée dans les lieux n’est plus possible ;
si le locataire ne donne aucune nouvelle avant le lendemain 10h, le propriétaire peut considérer la réservation comme annulée, disposer du logement, et conserver les sommes versées (hors taxe de séjour si non due).

9) Annulation par le propriétaire
En cas d’annulation par le propriétaire (hors force majeure), celui-ci remboursera au locataire l’intégralité des sommes effectivement versées dans un délai de 7 jours.

10) Force majeure
Aucune des parties ne pourra être tenue responsable si l’exécution du contrat est empêchée par un événement répondant à la définition de la force majeure.

11) État des lieux — Ménage — Entretien
Un état des lieux contradictoire est signé à l’arrivée et au départ (Annexe 4).

12) Dépôt de garantie (caution) — 500€ (en liquide à l’arrivée)
Un dépôt de garantie de 500€ est demandé en liquide à l’arrivée.
Il est restitué après l’état des lieux de sortie, déduction faite des sommes dues au titre :
dégradations, pertes, casse, nettoyage anormal, non-respect du règlement intérieur.

13) Identité du locataire
Présentation d’une pièce d’identité à l’arrivée (vérification uniquement). Aucun numéro de pièce n’est conservé.

14) Capacité — Personnes supplémentaires — Visiteurs
Capacité maximale : 8 personnes.
Supplément : 50€/personne/nuit et 50€/personne en journée, selon accord préalable.

15) Animaux
Supplément : 10€ par chien et par nuit (à régler à l’arrivée, sauf indication contraire).

16) Caméras (information)
Caméras uniquement sur les accès extérieurs, à des fins de sécurité. Aucune caméra à l’intérieur.

17) Assurance
Le locataire déclare être couvert par une assurance responsabilité civile villégiature (ou équivalent).

18) Utilisation paisible — Règlement intérieur
Respect du Règlement intérieur (Annexe 3).

19) Cession / Sous-location
Interdite sans accord écrit.

20) Litiges
Recherche de solution amiable, puis juridictions compétentes.

Signatures
Fait à Carcès, le ${signatureDate || "[date]"}.
En 2 exemplaires.
Le Propriétaire (signature précédée de la mention “Lu et approuvé”) :
[____________________]
Le Locataire (signature précédée de la mention “Lu et approuvé”) :
[____________________]

ANNEXE 1 — ÉTAT DESCRIPTIF DU LOGEMENT
${ANNEXE_1}

ANNEXE 2 — INVENTAIRE / LISTE ÉQUIPEMENTS
${ANNEXE_2}

ANNEXE 3 — RÈGLEMENT INTÉRIEUR (à signer)
${ANNEXE_3}

Signature du locataire (Annexe 3 — “Lu et approuvé”) :
[____________________]

ANNEXE 4 — ÉTAT DES LIEUX D’ENTRÉE / SORTIE
(À signer sur place.)

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

  // ✅ Si "t" absent => on autorise (fallback) — même logique que /contract
  const okToken = t
    ? verifyContractToken({
        rid,
        email: booking.email,
        secret: BOOKING_MODERATION_SECRET,
        token: t,
      })
    : true;

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

  // ✅ Date contrat obligatoire (JJ/MM/AAAA)
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

  // ✅ Si "t" absent => on autorise (fallback) — même logique que /contract
  const okToken = t
    ? verifyContractToken({
        rid,
        email: booking.email,
        secret: BOOKING_MODERATION_SECRET,
        token: t,
      })
    : true;

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
  const contractUrl = baseUrl ? `${baseUrl}/contract?rid=${rid}${t ? `&t=${encodeURIComponent(t)}` : ""}` : "";

  const arrivalYmd = String(booking.start_date || "").trim();
  const departureYmd = String(booking.end_date || "").trim();

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
  const soldeN = totalN != null && deposit30N != null ? round2(totalN - deposit30N) : null;

  const addressText = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${postalCode} ${city}, ${country}`;

  const occupantsText = normOccupants
    .map((o: any) => `- ${o.first_name} ${o.last_name} (${o.age} ans)`)
    .join("\n");

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
    signatureDate: contractDate,
  });

  const subjectOwner = `Contrat signé — Demande #${rid}`;

  const htmlOwner = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
      <h2>${escapeHtml(subjectOwner)}</h2>
      <p><b>Réservant</b> : ${escapeHtml(booking.name)} — ${escapeHtml(booking.email)} — ${escapeHtml(booking.phone || "")}</p>
      <p><b>Dates</b> : ${escapeHtml(formatDateFR(arrivalYmd))} → ${escapeHtml(formatDateFR(departureYmd))} (${nightsBetween(arrivalYmd, departureYmd)} nuit(s))</p>
      ${totalN != null ? `<p><b>Total</b> : ${escapeHtml(toMoneyEUR(totalN))}</p>` : ""}
      <p><b>Adresse</b> : ${escapeHtml(addressText)}</p>
      <p><b>Personnes présentes</b> :<br/>${escapeHtml(occupantsText).replace(/\n/g, "<br/>")}</p>
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
