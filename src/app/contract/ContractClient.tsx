// src/app/contract/ContractClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Occupant = { first_name: string; last_name: string; age: string };

type Booking = {
  id: string; // UUID (Supabase)
  full_name: string;
  email: string;
  phone?: string | null;

  arrival_date: string; // YYYY-MM-DD
  departure_date: string; // YYYY-MM-DD

  adults_count?: number | null;
  children_count?: number | null;
  animals_count?: number | null;

  pricing?: any;
};

type ExistingContract = {
  booking_request_id: string;
  signer_address_line1: string;
  signer_address_line2?: string | null;
  signer_postal_code: string;
  signer_city: string;
  signer_country: string;
  occupants: Occupant[];
  signed_at?: string | null;

  // ✅ si déjà signé / enregistré
  contract_date?: string | null; // JJ/MM/AAAA
} | null;

type Props = {
  booking: Booking;
  token: string;
  existing: ExistingContract;
};

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

function splitName(full: string): { first: string; last: string } {
  const s = String(full || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function toMoneyEUR(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(2)} €`;
}

function pickNumber(obj: any, keys: string[]): number | null {
  const o = obj || {};
  for (const k of keys) {
    const v = (o as any)?.[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function expectedPeopleCount(booking: Booking): number | null {
  const a = Number(booking?.adults_count ?? 0);
  const c = Number(booking?.children_count ?? 0);
  const total = (Number.isFinite(a) ? a : 0) + (Number.isFinite(c) ? c : 0);
  return total > 0 ? total : null;
}

function signedDateFRFromIso(iso: string | null | undefined): string | null {
  const s = String(iso || "").trim();
  if (!s) return null;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  try {
    return dt.toLocaleDateString("fr-FR");
  } catch {
    return null;
  }
}

// ✅ Date contrat : accepte "JJ/MM/AAAA" OU "JJMMAAAA" (utile sur mobile iOS)
function parseContractDateFR(
  input: string
): { ok: true; normalized: string } | { ok: false } {
  const s = String(input || "").trim();

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
    // 2) format compact "JJMMAAAA" (on ignore tous les non-chiffres)
    const digitsOnly = s.replace(/\D/g, "");
    const m2 = /^(\d{8})$/.exec(digitsOnly);
    if (!m2) return { ok: false };
    const digits = m2[1];
    dd = Number(digits.slice(0, 2));
    mm = Number(digits.slice(2, 4));
    yyyy = Number(digits.slice(4, 8));
  }

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return { ok: false };
  if (yyyy < 1900 || yyyy > 2200) return { ok: false };
  if (mm < 1 || mm > 12) return { ok: false };
  if (dd < 1 || dd > 31) return { ok: false };

  // validation calendrier réelle
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return { ok: false };
  }

  const normalized = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${String(yyyy).padStart(4, "0")}`;
  return { ok: true, normalized };
}

// ✅ Auto-format mobile : l'utilisateur peut taper "27012026" et on affiche "27/01/2026"
function formatContractDateWhileTyping(value: string): string {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatOtpWhileTyping(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export default function ContractClient({ booking, token, existing }: Props) {
  // ✅ Coordonnées propriétaire FIXES
  const OWNER = useMemo(
    () => ({
      name: "Laurens Coralie",
      address: "2542 chemin des près neufs 83570 Carcès",
      email: "laurens-coralie@hotmail.com",
      phone: "0629465295",
    }),
    []
  );

  // ✅ Adresse du logement FIXE
  const PROPERTY_ADDRESS = useMemo(() => "2542 chemin des près neufs 83570 Carcès", []);

  const expectedCount = useMemo(() => expectedPeopleCount(booking), [booking]);

  // ✅ on autorise jusqu’à 8, MAIS si la demande (adultes+enfants) est connue, on limite à ce nombre
  const maxOccupants = useMemo(() => {
    const e = expectedCount;
    if (e != null && e > 0) return Math.min(8, e);
    return 8;
  }, [expectedCount]);

  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(existing?.signer_address_line2 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [country, setCountry] = useState(existing?.signer_country || "France");

  // ✅ date du contrat (obligatoire, saisie manuelle, JJ/MM/AAAA) — auto-format si clavier numeric
  const [contractDate, setContractDate] = useState<string>(existing?.contract_date || "");

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // ✅ Flow OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [signedOk, setSignedOk] = useState(false);

  // ✅ date figée au moment de la signature (si on vient de signer sans reload)
  const [signedDateLocal, setSignedDateLocal] = useState<string | null>(null);

  const isSigned = Boolean(existing?.signed_at) || signedOk;

  useEffect(() => {
    // 1) si un contrat existe déjà -> reprendre
    if (existing?.occupants?.length) {
      setOccupants(existing.occupants.map((o) => ({ ...o })));
      return;
    }

    // 2) sinon -> générer une liste selon la demande (adultes+enfants) si dispo, sinon 1 personne
    const desired = maxOccupants > 0 ? maxOccupants : 1;

    const first = splitName(booking.full_name);
    const base: Occupant[] = Array.from({ length: desired }).map((_, i) => {
      if (i === 0) return { first_name: first.first, last_name: first.last, age: "" };
      return { first_name: "", last_name: "", age: "" };
    });
    setOccupants(base);
  }, [existing, booking.full_name, maxOccupants]);

  const disabledInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-900 disabled:opacity-100";

  const nights = useMemo(
    () => nightsBetween(booking.arrival_date, booking.departure_date),
    [booking.arrival_date, booking.departure_date]
  );

  /**
   * ✅ PRICING
   * - Total : pricing.total si présent (source de vérité)
   * - Hébergement : pricing.base_accommodation (ou calcul si manquant)
   * - Ménage : fixe (fallback 100)
   * - Options : si options_total existe => on l'utilise ; sinon on somme toutes les clés numériques
   * - Taxe : tourist_tax
   * - Acompte : 30% total / Solde : total - acompte
   */
  const pricingNumbers = useMemo(() => {
    const p = booking?.pricing || {};

    const total = pickNumber(p, ["total", "total_price", "grand_total", "amount_total"]) ?? null;

    const cleaning = pickNumber(p, ["cleaning", "cleaning_fee", "cleaningFee", "menage"]) ?? 100;

    const accommodation =
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

    const touristTax =
      pickNumber(p, ["tourist_tax", "taxe_sejour", "taxe_de_sejour", "city_tax", "local_tax"]) ?? 0;

    // ✅ options_total direct (si présent)
    const optionsDirect =
      pickNumber(p, ["options_total", "extras_total", "extras", "options", "addon_total", "add_ons_total"]) ?? null;

    // ✅ sinon : somme de toutes les options stockées (numériques) en excluant les postes non-options
    const optionsComputed = (() => {
      const excluded = new Set([
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
        "options_total",
        "extras_total",
        "extras",
        "options",
        "addon_total",
        "add_ons_total",
      ]);

      let sum = 0;
      for (const [k, v] of Object.entries(p || {})) {
        if (excluded.has(k)) continue;
        const n = Number(v as any);
        if (!Number.isFinite(n)) continue;
        sum += n;
      }
      return round2(sum);
    })();

    const options = optionsDirect != null ? optionsDirect : optionsComputed;

    // Si accommodation manquante MAIS total présent : calcul propre
    let accommodationFixed = accommodation;
    if (accommodationFixed == null && total != null) {
      const computed = total - cleaning - options - touristTax;
      accommodationFixed = Number.isFinite(computed) && computed >= 0 ? round2(computed) : null;
    }

    const deposit30 = total != null ? round2(total * 0.3) : null;
    const solde = total != null && deposit30 != null ? round2(total - deposit30) : null;

    return { total, accommodation: accommodationFixed, cleaning, options, touristTax, deposit30, solde };
  }, [booking.pricing]);

  const priceTotal = useMemo(
    () => (pricingNumbers.total != null ? toMoneyEUR(pricingNumbers.total) : ""),
    [pricingNumbers.total]
  );

  const deposit30 = useMemo(
    () => (pricingNumbers.deposit30 != null ? toMoneyEUR(pricingNumbers.deposit30) : ""),
    [pricingNumbers.deposit30]
  );

  const solde70 = useMemo(
    () => (pricingNumbers.solde != null ? toMoneyEUR(pricingNumbers.solde) : ""),
    [pricingNumbers.solde]
  );

  // ✅ Affichage dans "Fait à Carcès, le …" :
  // - si contrat déjà signé => date enregistrée (existing.contract_date)
  // - sinon => date saisie par l’utilisateur (contractDate)
  const signatureDateFR = useMemo(() => {
    const fromDb = String(existing?.contract_date || "").trim();
    if (fromDb) return fromDb;

    const typed = String(contractDate || "").trim();
    if (typed) return typed;

    return "[date]";
  }, [existing?.contract_date, contractDate]);

  const contractText = useMemo(() => {
    const occupantsText = occupants
      .map((o, i) => {
        const fn = String(o.first_name || "").trim();
        const ln = String(o.last_name || "").trim();
        const ag = String(o.age || "").trim();
        const line = [fn, ln].filter(Boolean).join(" ").trim();
        const agePart = ag ? ` — ${ag} ans` : "";
        return `${i + 1}. ${line || "[Nom Prénom]"}${agePart || " — [Âge]"}`;
      })
      .join("\n");

    const addressText =
      [addressLine1, addressLine2, `${postalCode} ${city}`.trim(), country]
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .join(", ") || "[Adresse à compléter]";

    const accommodationText =
      pricingNumbers.accommodation != null ? toMoneyEUR(pricingNumbers.accommodation) : "[____ €]";

    const cleaningText = pricingNumbers.cleaning != null ? toMoneyEUR(pricingNumbers.cleaning) : "100€";

    const optionsText = pricingNumbers.options != null ? toMoneyEUR(pricingNumbers.options) : "[____ €]";

    const touristTaxText = pricingNumbers.touristTax != null ? toMoneyEUR(pricingNumbers.touristTax) : "[____ €]";

    // ✅ ANNEXES : INTÉGRALEMENT COLLÉES DANS LE CONTRAT (1,2,3)
    const annexe1 = `ANNEXE 1 — ÉTAT DESCRIPTIF DU LOGEMENT : En résumé
À lire avant réservation

Bergerie provençale en pleine nature, grand confort, piscine au sel, accès rapide lac/cascades, et espaces pensés pour les familles comme pour les séjours entre amis.

🌿
Cadre & localisation
8 points • Cliquez pour réduire

˅
🌿
Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.

📍
À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).

🏞️
À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière, idéal pour les amoureux de plein air.

💧
Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été et paysages superbes.

🌳
Terrain arboré de 3 750 m² : pins, chênes, oliviers et essences provençales, sans vis-à-vis.

✨
Nuits incroyables : ciel étoilé, silence, ambiance “seul au monde” au cœur de la nature.

🦌
Rencontres possibles : biches, chevreuils, renards (la forêt méditerranéenne est tout autour).

🚗
Accès par piste forestière : arrivée dépaysante, immersion totale dès les premières minutes.

Réduire

🏡
Le logement
8 points • Cliquez pour réduire

˅
👨‍👩‍👧‍👦
Une villa spacieuse et conviviale (215 m²) pensée pour partager des moments en famille ou entre amis.

🍽️
Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m², côté piscine et forêt.

🌤️
Grande véranda lumineuse avec grandes tables, parfaite pour les repas “dedans-dehors”.

🔥
Salon cosy avec poêle à bois, TV et coin bar (ambiance chaleureuse le soir).

🛏️
Chambre XXL (≈35 m²) avec deux lits doubles, dressing, décoration apaisante.

🧸
Chambre familiale avec lit double, lit bébé, jeux, livres, espace enfant (pratique et rassurant).

🚿
Salle de bains avec grande douche à l’italienne, double vasque, rangements, serviettes fournies.

🚻
WC séparé avec lave-mains pour plus de confort.

Réduire

🛌
Suite indépendante
2 points • Cliquez pour dérouler

˅
🛌
Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo.

⚽
Baby-foot à disposition dans la suite (bonus très apprécié).

🏝️
Extérieurs & équipements
8 points • Cliquez pour réduire

˅
🌀
Piscine au sel (Diffazur) : transats, bouées et jeux, pour des journées 100% détente.

🎾
Terrain de badminton.

🏀
Panier de basket.

🎯
Terrain de boules pour l’esprit “vacances en Provence”.

🛝
Jeux pour enfants.

🌴
Espace repas ombragé sous un grand arbre, idéal pour les déjeuners d’été.

🚗
Grand parking gratuit + abri voiture sur la propriété.

🥾
Départ de balades direct : forêt, lac, cascades, randonnées accessibles rapidement.

Réduire

🌟
Petite touche unique
1 point • Cliquez pour dérouler

˅
🧑‍🌾
Maison de gardien à env. 50 m : présence rassurante et aide possible en cas de besoin.`;

    const annexe2 = `ANNEXE 2 — INVENTAIRE / LISTE ÉQUIPEMENTS : Ce que propose ce logement
Les équipements listés ci-dessous sont disponibles sur place (selon l’organisation du logement).

Réduire
Rechercher un équipement (ex : lave-vaisselle, lit bébé, Wi-Fi…)…
🔎
Astuce : tape un mot-clé pour filtrer instantanément.
🛁
Salle de bain
8 éléments

Inclus
💨
2 sèche-cheveux
🚿
2 douches à l’italienne
🧺
Machine à laver
🧼
Produits de nettoyage
🧴
Shampooing
🫧
Savon pour le corps
🫧
Gel douche
🔥
Eau chaude
🛏️
Chambre et linge
15 éléments

Inclus
✅
Équipements de base
Serviettes, draps, savon et papier toilette
🧳
Grand dressing
🧥
Cintres
🧻
Draps
🛌
Couettes
🛌
Couvertures supplémentaires
🛏️
4 oreillers par lit
🛏️
Traversins
🛋️
Tables de nuit
💡
Lampes de chevet
🪟
Stores
🧲
Fer à repasser
🧵
Étendoir à linge
🦟
Moustiquaire
🧳
Espace de rangement vêtements
Dressing, placard et armoire
🎬
Divertissement
11 éléments

Inclus
🛰️
Connexion maxi vitesse par satellite via Starlink
📺
Télévision (chaînes + Netflix + jeux vidéos)
📚
Livres & de quoi lire
🧩
Jeux extérieurs / intérieurs pour enfants
🎯
Terrain de boules
💦
Jeux aquatiques
🏸
Terrain de badminton
🏀
Panier de basket
🏊
Piscine
🥾
Randonnées : lac, rivière, cascades, canal, forêt
🃏
Jeux pour adultes : jeux de société, cartes, etc.
👨‍👩‍👧‍👦
Famille
10 éléments

Inclus
👶
Lit pour bébé
Toujours dans le logement • Standard (1,3 m x 70 cm) • draps fournis
🧸
Lit parapluie
Toujours dans le logement • draps fournis
🧩
Livres & jouets pour enfants
🪑
Chaise haute
🛡️
Pare-feu pour le poêle
🧸
Salle de jeux pour enfants
Une salle avec des jouets, des livres et des jeux
🛝
Aire de jeux extérieure
Structures de jeux pour enfants
🚨
Alarme de sécurité pour piscine
💦
Jeux aquatiques
🐟
Petit bassin avec carpes et grenouilles
🔥
Chauffage et climatisation
3 éléments

Inclus
🔥
Poêle à bois (en option)
🌀
Ventilateurs portables
🌡️
Chauffage central
🧯
Sécurité à la maison
5 éléments

Inclus
🚨
Détecteur de fumée
⚠️
Détecteur de monoxyde de carbone
🧯
Extincteur
🩹
Kit de premiers secours
🧯
Bâches anti-feu
🍽️
Cuisine et salle à manger
18 éléments

Inclus
🍳
Cuisine
Espace où les voyageurs peuvent cuisiner
🧊
Réfrigérateur
📡
Four à micro-ondes
🧊
Mini réfrigérateur (dans la chambre VIP)
❄️
Congélateur
🧼
Lave-vaisselle
🔥
Cuisinière
♨️
Four
🫖
Bouilloire électrique
☕
Cafetière
☕
Café
🍷
Verres à vin
🍞
Grille-pain
🍳
Plaque de cuisson
🧂
Équipements de cuisine de base
Casseroles & poêles, huile, sel et poivre
🍽️
Vaisselle & couverts
Bols, assiettes, tasses, etc.
🍖
Ustensiles de barbecue
Charbon, brochettes, etc.
🪑
Table à manger
📍
Caractéristiques de l’emplacement
3 éléments

Inclus
🌊
Accès au lac, rivière, cascades, canal, forêt
Accès à pied via sentier / quai
🚪
Entrée privée par piste en terre
Arrivée par une piste en terre
🧺
Laverie automatique à proximité (Intermarché)
🌿
Extérieur
6 éléments

Inclus
🌤️
Patio ou balcon
🌱
Arrière-cour
Espace ouvert généralement recouvert d’herbe
🪑
Mobilier d’extérieur
🍽️
Espace repas en plein air
🔥
Barbecue
Électrique
🧘
Chaises longues
🚗
Parking et installations
2 éléments

Inclus
🅿️
Parking gratuit sur place
🏊
Piscine privée
🧾
Services
4 éléments

Inclus
🐾
Animaux acceptés avec supplément
🚭
Logement non fumeur
📅
Séjours longue durée autorisés
28 jours ou plus
🔑
Clés remises par l’hôte.`;

    const annexe3 = `ANNEXE 3 — RÈGLEMENT INTÉRIEUR : Informations importantes à lire avant signature du contrat
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
📍 Départ à 10h maximum avec check-out obligatoire. La maison doit être libre et vide des locataires et de leurs bagages à 10h au plus tard par respect pour les arrivants. Si vous souhaitez partir plus tôt, nous viendrons vérifier la maison. Départ en fin de journée possible avec supplément de 70 € (selon disponibilités).`;

    return `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS —

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : ${OWNER.name}
Adresse : ${OWNER.address}
E-mail : ${OWNER.email}
Téléphone : ${OWNER.phone}

Locataire
Nom / Prénom : ${booking.full_name || "[]"}
Adresse : ${addressText}
E-mail : ${booking.email || "[]"}
Téléphone : ${booking.phone || "[]"}

Le locataire déclare être majeur et avoir la capacité de contracter.

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : ${PROPERTY_ADDRESS}
Capacité maximale : 8 personnes (voir Article 11).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

Annexes (faisant partie intégrante du contrat) :
Annexe 1 : État descriptif du logement
Annexe 2 : Inventaire / liste équipements
Annexe 3 : Règlement intérieur (à signer)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)

3) Durée — Dates — Horaires
Période : du ${formatDateFR(booking.arrival_date)} au ${formatDateFR(booking.departure_date)} pour ${nights} nuits.
Horaires standard
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)
Options (si accord préalable et selon disponibilités) :
Arrivée début de journée : +70€
Départ fin de journée : +70€

4) Prix — Taxes — Prestations
Prix total du séjour : ${priceTotal || "[____ €]"} comprenant :
Hébergement : ${accommodationText}
Forfait ménage : ${cleaningText}
Options éventuelles : ${optionsText}
Taxe de séjour : ${touristTaxText} (si applicable / selon règles locales)

5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)
Mode de paiement : virement bancaire uniquement.
Aucun paiement par chèque n’est accepté.

5.1 Acompte (30%)
Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit ${deposit30 || "[____ €]"}.
✅ Les parties conviennent expressément que la somme versée à la réservation constitue un ACOMPTE et non des arrhes.

5.2 Solde
Le solde, soit ${solde70 || "[____ €]"}, doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.
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
dégradations, pertes, casse, nettoyage anormal.
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

18) Utilisation paisible
Le locataire s’engage à une jouissance paisible des lieux.

19) Cession / Sous-location
La location ne peut bénéficier à des tiers, sauf accord écrit du propriétaire. Toute infraction peut entraîner résiliation immédiate sans remboursement.

20) Litiges
Contrat entre particuliers. En cas de difficulté, les parties recherchent une solution amiable.
À défaut, le litige relèvera des juridictions compétentes selon les règles de droit commun.

Signatures
Fait à Carcès, le ${signatureDateFR}.
En 2 exemplaires.
Le Propriétaire (signature précédée de la mention “Lu et approuvé”) :
[____________________]
Le Locataire (signature précédée de la mention “Lu et approuvé”) :
[____________________]

${annexe1}

${annexe2}

${annexe3}

ANNEXE 4 — ÉTAT DES LIEUX D’ENTRÉE / SORTIE
(À signer sur place.)

—
Personnes présentes pendant la location (nom, prénom, âge)
${occupantsText}
`;
  }, [
    occupants,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    country,
    booking.full_name,
    booking.email,
    booking.phone,
    booking.arrival_date,
    booking.departure_date,
    nights,
    priceTotal,
    deposit30,
    solde70,
    OWNER,
    PROPERTY_ADDRESS,
    pricingNumbers.accommodation,
    pricingNumbers.cleaning,
    pricingNumbers.options,
    pricingNumbers.touristTax,
    signatureDateFR,
  ]);

  const allOccupantsFilled = useMemo(() => {
    return occupants.every((o) => {
      const fn = String(o.first_name || "").trim();
      const ln = String(o.last_name || "").trim();
      const ag = String(o.age || "").trim();
      return Boolean(fn && ln && ag);
    });
  }, [occupants]);

  function addOccupant() {
    if (isSigned) return;
    if (occupants.length >= maxOccupants) return;
    setOccupants((prev) => [...prev, { first_name: "", last_name: "", age: "" }]);
  }

  function removeOccupant(index: number) {
    if (isSigned) return;
    setOccupants((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function validateBeforeSendOrVerify(): { ok: true; contractDate: string } | { ok: false } {
    setError(null);
    setOkMsg(null);

    if (isSigned) return { ok: false };

    // ✅ le lien doit contenir un token (t=...) pour autoriser la signature
    if (!String(token || "").trim()) {
      setError("Lien invalide : token manquant. Merci d’ouvrir le lien reçu par email (ou de redemander le lien).");
      return { ok: false };
    }

    if (!addressLine1.trim() || !postalCode.trim() || !city.trim() || !country.trim()) {
      setError("Adresse incomplète.");
      return { ok: false };
    }

    // ✅ date de contrat obligatoire (saisie manuelle)
    const parsed = parseContractDateFR(contractDate);
    if (!parsed.ok) {
      setError("Merci de renseigner la date du contrat au format JJ/MM/AAAA (ou JJMMAAAA).");
      return { ok: false };
    }

    if (!acceptedTerms) {
      setError("Vous devez accepter le contrat.");
      return { ok: false };
    }

    if (occupants.length < 1) {
      setError("Ajoutez au moins une personne (nom, prénom, âge).");
      return { ok: false };
    }

    if (occupants.length > maxOccupants) {
      setError(`Maximum ${maxOccupants} personne(s).`);
      return { ok: false };
    }

    if (!allOccupantsFilled) {
      setError("Merci de renseigner nom, prénom et âge pour chaque personne.");
      return { ok: false };
    }

    return { ok: true, contractDate: parsed.normalized };
  }

  async function sendOtp() {
    const v = validateBeforeSendOrVerify();
    if (!v.ok) return;

    setSendingOtp(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          rid: booking.id,
          t: token,
          signer_address_line1: addressLine1,
          signer_address_line2: addressLine2,
          signer_postal_code: postalCode,
          signer_city: city,
          signer_country: country,
          occupants,
          accepted_terms: true,
          contract_date: v.contractDate,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Erreur lors de l’envoi du code.");
        return;
      }

      setOtpSent(true);
      setOkMsg("Code envoyé ✅ Vérifiez votre email puis saisissez le code à 6 chiffres.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    const v = validateBeforeSendOrVerify();
    if (!v.ok) return;

    const cleaned = formatOtpWhileTyping(otpCode);
    if (cleaned.length !== 6) {
      setError("Saisissez le code à 6 chiffres.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          rid: booking.id,
          t: token,
          otp_code: cleaned,
          signer_address_line1: addressLine1,
          signer_address_line2: addressLine2,
          signer_postal_code: postalCode,
          signer_city: city,
          signer_country: country,
          occupants,
          accepted_terms: true,
          contract_date: v.contractDate,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Code invalide. Réessayez.");
        return;
      }

      // ✅ fige la date au moment exact où l’utilisateur signe (sans attendre un reload)
      try {
        setSignedDateLocal(new Date().toLocaleDateString("fr-FR"));
      } catch {
        setSignedDateLocal(null);
      }

      // ✅ fige aussi la date de contrat côté UI
      setContractDate(v.contractDate);

      setSignedOk(true);
      setOkMsg("Contrat signé ✅ Un email de confirmation a été envoyé.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  const signedDateFR = useMemo(() => {
    if (signedDateLocal) return signedDateLocal;
    return signedDateFRFromIso(existing?.signed_at) || null;
  }, [signedDateLocal, existing?.signed_at]);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-r from-[#06243D] via-[#053A63] to-[#0B2A7A]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-white/80 text-sm">Superbe bergerie • Contrat de location</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Contrat de location saisonnière</h1>
          {isSigned && (
            <div className="mt-3 text-white/80 text-sm">
              Contrat signé {signedDateFR ? `le ${signedDateFR}` : ""} ✅
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-14">
        <div className="-mt-8 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <div className="text-sm text-slate-600">
            Les informations importantes (dates, prix, réservation) sont verrouillées.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold tracking-wide text-slate-500">RÉSERVATION</div>
              <div className="mt-3 space-y-1 text-sm text-slate-900">
                <div>
                  <span className="font-semibold">Nom :</span> {booking.full_name}
                </div>
                <div>
                  <span className="font-semibold">Email :</span> {booking.email}
                </div>
                <div>
                  <span className="font-semibold">Téléphone :</span> {booking.phone || "—"}
                </div>
                <div>
                  <span className="font-semibold">Dates :</span> {formatDateFR(booking.arrival_date)} →{" "}
                  {formatDateFR(booking.departure_date)} ({nights} nuit(s))
                </div>
                {priceTotal ? (
                  <div>
                    <span className="font-semibold">Total :</span> {priceTotal}
                  </div>
                ) : null}
                {expectedCount != null ? (
                  <div>
                    <span className="font-semibold">Personnes demandées :</span> {expectedCount} (adultes + enfants)
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold">Personnes :</span> jusqu’à 8
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold tracking-wide text-slate-500">VOTRE ADRESSE POSTALE</div>

              <div className="mt-3 space-y-3">
                <input
                  className={disabledInputClass}
                  placeholder="Adresse (ligne 1) *"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  disabled={isSigned}
                />
                <input
                  className={disabledInputClass}
                  placeholder="Complément (optionnel)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  disabled={isSigned}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={disabledInputClass}
                    placeholder="Code postal *"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    disabled={isSigned}
                  />
                  <input
                    className={disabledInputClass}
                    placeholder="Ville *"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isSigned}
                  />
                </div>
                <input
                  className={disabledInputClass}
                  placeholder="Pays *"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isSigned}
                />
              </div>
            </div>
          </div>

          {/* ✅ Date du contrat obligatoire */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">DATE DU CONTRAT (OBLIGATOIRE)</div>

            <div className="mt-3 grid gap-2 md:grid-cols-2 md:items-center">
              <input
                className={disabledInputClass}
                placeholder="JJ/MM/AAAA *"
                value={contractDate}
                onChange={(e) => setContractDate(formatContractDateWhileTyping(e.target.value))}
                disabled={isSigned}
                inputMode="numeric"
              />
              <div className="text-sm text-slate-600">
                Cette date sera affichée dans la ligne : <span className="font-semibold">“Fait à Carcès, le …”</span>
              </div>
            </div>

            {!isSigned && contractDate.trim() ? (
              parseContractDateFR(contractDate).ok ? null : (
                <div className="mt-2 text-xs text-amber-700">
                  Format attendu : JJ/MM/AAAA (ou JJMMAAAA) — ex : 03/02/2026
                </div>
              )
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">CONTRAT (À LIRE)</div>

            <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">{contractText}</div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              PERSONNES PRÉSENTES PENDANT LA LOCATION (NOM, PRÉNOM, ÂGE) — MAX {maxOccupants}
            </div>

            <div className="mt-4 space-y-3">
              {occupants.map((o, i) => (
                <div key={i} className="space-y-2">
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className={disabledInputClass}
                      placeholder="Prénom *"
                      value={o.first_name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOccupants((prev) => prev.map((x, idx) => (idx === i ? { ...x, first_name: v } : x)));
                      }}
                      disabled={isSigned}
                    />
                    <input
                      className={disabledInputClass}
                      placeholder="Nom *"
                      value={o.last_name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOccupants((prev) => prev.map((x, idx) => (idx === i ? { ...x, last_name: v } : x)));
                      }}
                      disabled={isSigned}
                    />
                    <input
                      className={disabledInputClass}
                      placeholder="Âge *"
                      value={o.age}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOccupants((prev) => prev.map((x, idx) => (idx === i ? { ...x, age: v } : x)));
                      }}
                      disabled={isSigned}
                      inputMode="numeric"
                    />
                  </div>

                  {occupants.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeOccupant(i)}
                      disabled={isSigned}
                      className="text-xs text-slate-600 underline disabled:opacity-50"
                    >
                      Supprimer cette personne
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addOccupant}
                disabled={isSigned || occupants.length >= maxOccupants}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                + Ajouter une personne
              </button>

              <div className="text-sm text-slate-600">
                Pour signer, toutes les personnes (nom, prénom, âge) doivent être renseignées.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">SIGNATURE</div>

            <label className="mt-3 flex items-start gap-3 text-sm text-slate-900">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={isSigned}
              />
              <span>J’ai lu et j’accepte le contrat. Je certifie que les informations sont exactes.</span>
            </label>

            <div className="mt-3 text-sm text-slate-700">
              <div className="font-semibold">Pourquoi un code de signature ?</div>
              <div className="mt-1 text-slate-600">
                Pour confirmer que la personne qui signe a bien accès à l’email utilisé pour la réservation,
                nous envoyons un <span className="font-semibold">code unique à 6 chiffres</span>.
                Cela évite qu’un tiers signe à votre place.
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}

            {okMsg ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {okMsg}
              </div>
            ) : null}

            {/* ✅ Étape 1 : envoyer le code */}
            {!isSigned ? (
              <button
                type="button"
                onClick={sendOtp}
                disabled={!String(token || "").trim() || sendingOtp || verifyingOtp}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingOtp ? "Envoi du code..." : otpSent ? "Renvoyer le code (6 chiffres)" : "Recevoir un code de signature (6 chiffres)"}
              </button>
            ) : null}

            {!isSigned && !String(token || "").trim() ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Signature désactivée : lien sans token. Utilisez le lien envoyé par email (il contient <b>t=...</b>).
              </div>
            ) : null}

            {/* ✅ Étape 2 : saisir + vérifier */}
            {!isSigned && otpSent ? (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Code reçu par email</div>
                <div className="mt-2 grid gap-3 md:grid-cols-2 md:items-center">
                  <input
                    className={disabledInputClass}
                    placeholder="Code (6 chiffres) *"
                    value={otpCode}
                    onChange={(e) => setOtpCode(formatOtpWhileTyping(e.target.value))}
                    inputMode="numeric"
                    disabled={verifyingOtp || sendingOtp}
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={verifyingOtp || sendingOtp}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verifyingOtp ? "Vérification..." : "Confirmer la signature"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Le code est valable environ 10 minutes. Si besoin, cliquez sur “Renvoyer le code”.
                </div>
              </div>
            ) : null}

            <div className="mt-2 text-xs text-slate-500">
              En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
