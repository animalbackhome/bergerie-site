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

function expectedPeopleCount(booking: Booking): number | null {
  const a = Number(booking?.adults_count ?? 0);
  const c = Number(booking?.children_count ?? 0);
  const total = (Number.isFinite(a) ? a : 0) + (Number.isFinite(c) ? c : 0);
  return total > 0 ? total : null;
}

/**
 * Optionnel (mais recommandé) :
 * tu peux définir ces valeurs dans Vercel env (NEXT_PUBLIC_...) pour auto-remplir le contrat.
 */
const OWNER = {
  name: process.env.NEXT_PUBLIC_OWNER_NAME || "",
  address: process.env.NEXT_PUBLIC_OWNER_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_OWNER_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_OWNER_PHONE || "",
};

const PROPERTY_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_ADDRESS || "";

export default function ContractClient({ booking, token, existing }: Props) {
  const expectedCount = useMemo(() => expectedPeopleCount(booking), [booking]);
  const hardCount = expectedCount ?? 1;

  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(existing?.signer_address_line2 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [country, setCountry] = useState(existing?.signer_country || "France");
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedOk, setSignedOk] = useState(false);

  const isSigned = Boolean(existing?.signed_at) || signedOk;

  useEffect(() => {
    // Initialiser occupants : EXACTEMENT le nombre demandé (adultes + enfants)
    const desired = hardCount;

    // 1) si un contrat existe déjà et a exactement le bon nombre -> reprendre
    if (existing?.occupants?.length === desired) {
      setOccupants(existing.occupants.map((o) => ({ ...o })));
      return;
    }

    // 2) sinon -> générer une liste de "desired" lignes
    const first = splitName(booking.full_name);
    const base: Occupant[] = Array.from({ length: desired }).map((_, i) => {
      if (i === 0) {
        return { first_name: first.first, last_name: first.last, age: "" };
      }
      return { first_name: "", last_name: "", age: "" };
    });
    setOccupants(base);
  }, [existing, booking.full_name, hardCount]);

  const disabledInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-900 disabled:opacity-100";

  const nights = useMemo(
    () => nightsBetween(booking.arrival_date, booking.departure_date),
    [booking.arrival_date, booking.departure_date]
  );

  const priceTotal = useMemo(() => {
    // On essaie plusieurs clés possibles selon ton objet pricing
    const p = booking?.pricing || {};
    const v =
      p?.total ??
      p?.total_price ??
      p?.grand_total ??
      p?.amount_total ??
      null;

    return v != null ? toMoneyEUR(v) : "";
  }, [booking.pricing]);

  const deposit30 = useMemo(() => {
    // Montant estimé (30%) calculé depuis le total si dispo
    const p = booking?.pricing || {};
    const v =
      p?.total ??
      p?.total_price ??
      p?.grand_total ??
      p?.amount_total ??
      null;

    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return toMoneyEUR(n * 0.3);
  }, [booking.pricing]);

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

    // IMPORTANT: le texte ci-dessous contient TOUT le contrat + annexes,
    // sans suppression. Les champs [____] restent visibles si une info n'est pas connue.
    return `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS —

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : ${OWNER.name || "[]"}
Adresse : ${OWNER.address || "[]"}
E-mail : ${OWNER.email || "[]"}
Téléphone : ${OWNER.phone || "[]"}

Locataire
Nom / Prénom : ${booking.full_name || "[]"}
Adresse : ${addressText}
E-mail : ${booking.email || "[]"}
Téléphone : ${booking.phone || "[]"}

Le locataire déclare être majeur et avoir la capacité de contracter.

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : ${PROPERTY_ADDRESS || "[____________________]"}
Capacité maximale : 8 personnes (voir Article 11).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

Annexes (faisant partie intégrante du contrat) :
Annexe 1 : État descriptif du logement (repris du site)
Annexe 2 : Inventaire / liste équipements (repris du site)
Annexe 3 : Règlement intérieur (repris et signé)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)

3) Durée — Dates — Horaires
Période : du ${formatDateFR(booking.arrival_date)} au ${formatDateFR(
      booking.departure_date
    )} pour ${nights} nuits.
Horaires standard (selon ton site)
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)
Options (si accord préalable et selon disponibilités) :
Arrivée début de journée : +70€
Départ fin de journée : +70€

4) Prix — Taxes — Prestations
Prix total du séjour : ${priceTotal || "[____ €]"} comprenant :
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
  ]);

  const allOccupantsFilled = useMemo(() => {
    return occupants.every((o) => {
      const fn = String(o.first_name || "").trim();
      const ln = String(o.last_name || "").trim();
      const ag = String(o.age || "").trim();
      return Boolean(fn && ln && ag);
    });
  }, [occupants]);

  async function onSubmit() {
    setError(null);
    setOkMsg(null);

    if (isSigned) return;

    if (!addressLine1.trim() || !postalCode.trim() || !city.trim() || !country.trim()) {
      setError("Adresse incomplète.");
      return;
    }

    if (!acceptedTerms) {
      setError("Vous devez accepter le contrat.");
      return;
    }

    if (occupants.length !== hardCount) {
      setError(`Vous devez renseigner exactement ${hardCount} personne(s), comme dans votre demande.`);
      return;
    }

    if (!allOccupantsFilled) {
      setError("Merci de renseigner nom, prénom et âge pour chaque personne.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rid: booking.id,
          t: token,
          signer_address_line1: addressLine1,
          signer_address_line2: addressLine2,
          signer_postal_code: postalCode,
          signer_city: city,
          signer_country: country,
          occupants,
          accepted_terms: true,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Erreur lors de la signature.");
        return;
      }

      setSignedOk(true);
      setOkMsg("Contrat signé ✅ Un email de confirmation a été envoyé.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Bandeau haut (plus sombre) */}
      <div className="bg-gradient-to-r from-[#06243D] via-[#053A63] to-[#0B2A7A]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-white/80 text-sm">Superbe bergerie • Contrat de location</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Contrat de location saisonnière</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-14">
        <div className="-mt-8 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <div className="text-sm text-slate-600">
            Les informations importantes (dates, prix, réservation) sont verrouillées.
          </div>

          {/* Top cards */}
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
                ) : null}
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

          {/* Contract full text */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">CONTRAT (À LIRE)</div>

            <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">{contractText}</div>
            </div>
          </div>

          {/* Occupants (exact count) */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              PERSONNES PRÉSENTES PENDANT LA LOCATION (NOM, PRÉNOM, ÂGE) — EXACTEMENT {hardCount}
            </div>

            <div className="mt-4 space-y-3">
              {occupants.map((o, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-3">
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
              ))}
            </div>

            <div className="mt-3 text-sm text-slate-600">
              Pour signer, toutes les personnes (nom, prénom, âge) doivent être renseignées.
            </div>
          </div>

          {/* Signature */}
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
              <span>
                J’ai lu et j’accepte le contrat. Je certifie que les informations sont exactes.
              </span>
            </label>

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {okMsg ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {okMsg}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSigned || submitting}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Envoi..." : "Signer et envoyer le contrat"}
            </button>

            <div className="mt-2 text-xs text-slate-500">
              En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
