// src/app/contract/ContractClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = {
  id: string; // UUID
  full_name: string;
  email: string;
  phone?: string;
  arrival_date: string;
  departure_date: string;
  pricing?: any;
  adults_count?: number | null;
  children_count?: number | null;
  animals_count?: number | null;
};

type ExistingContract = {
  booking_request_id: string; // UUID
  signer_address_line1: string;
  signer_address_line2?: string | null;
  signer_postal_code: string;
  signer_city: string;
  signer_country: string;
  occupants: Array<{ first_name: string; last_name: string; age: string }>;
  signed_at?: string;
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

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(2)} €`;
}

function safeNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ContractClient({ booking, token, existing }: Props) {
  const isSigned = Boolean(existing?.signed_at);

  const [address1, setAddress1] = useState(existing?.signer_address_line1 || "");
  const [address2, setAddress2] = useState(existing?.signer_address_line2 || "");
  const [zip, setZip] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [country, setCountry] = useState(existing?.signer_country || "France");

  const expectedOccupants = useMemo(() => {
    const a = safeNumber(booking.adults_count) ?? 0;
    const c = safeNumber(booking.children_count) ?? 0;
    const total = a + c;
    return total > 0 ? total : null;
  }, [booking.adults_count, booking.children_count]);

  const initialOccupants = useMemo(() => {
    if (existing?.occupants?.length) return existing.occupants;

    const parts = (booking.full_name || "").trim().split(/\s+/);
    const first_name = parts.slice(0, -1).join(" ") || parts[0] || "";
    const last_name = parts.slice(-1).join(" ") || "";

    const base = [{ first_name, last_name, age: "" }];

    if (expectedOccupants && expectedOccupants > 1) {
      return [
        ...base,
        ...Array.from({ length: expectedOccupants - 1 }).map(() => ({
          first_name: "",
          last_name: "",
          age: "",
        })),
      ];
    }
    return base;
  }, [existing, booking.full_name, expectedOccupants]);

  const [occupants, setOccupants] = useState(initialOccupants);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setOccupants(initialOccupants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  function updateOcc(i: number, key: "first_name" | "last_name" | "age", value: string) {
    setOccupants((prev) => prev.map((o, idx) => (idx === i ? { ...o, [key]: value } : o)));
  }

  function addOcc() {
    setOccupants((prev) => [...prev, { first_name: "", last_name: "", age: "" }]);
  }

  function removeOcc(i: number) {
    setOccupants((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = booking?.pricing?.total != null ? Number(booking.pricing.total) : null;
  const acompte30 = total != null && Number.isFinite(total) ? Math.round(total * 0.3 * 100) / 100 : null;
  const solde70 = total != null && Number.isFinite(total) ? Math.round((total - (acompte30 ?? 0)) * 100) / 100 : null;

  const occupantsFilled = useMemo(() => {
    return occupants
      .map((o) => ({
        first_name: String(o.first_name || "").trim(),
        last_name: String(o.last_name || "").trim(),
        age: String(o.age || "").trim(),
      }))
      .filter((o) => o.first_name && o.last_name && o.age);
  }, [occupants]);

  const occupantsCountOk = useMemo(() => {
    if (!expectedOccupants) return occupantsFilled.length >= 1;
    return occupantsFilled.length === expectedOccupants;
  }, [expectedOccupants, occupantsFilled.length]);

  const canSubmit = useMemo(() => {
    if (isSigned) return false;
    if (!accepted) return false;
    if (!address1.trim() || !zip.trim() || !city.trim() || !country.trim()) return false;
    if (!occupantsCountOk) return false;
    return true;
  }, [isSigned, accepted, address1, zip, city, country, occupantsCountOk]);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rid: booking.id, // UUID
          t: token,
          signer_address_line1: address1,
          signer_address_line2: address2,
          signer_postal_code: zip,
          signer_city: city,
          signer_country: country,
          occupants,
          accepted_terms: accepted,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erreur inconnue");
      }
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100vh] bg-[#053B5A]">
      {/* Header bleu plus sombre */}
      <div className="bg-gradient-to-r from-[#052E4A] via-[#083A5F] to-[#1D2DAA]">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-white/80 text-sm">Superbe bergerie • Contrat de location</div>
          <h1 className="text-white text-3xl md:text-4xl font-bold mt-1">
            Contrat de location saisonnière
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-10 -mt-6">
        <div className="rounded-2xl bg-white shadow-xl border border-white/60 p-6">
          <p className="text-sm text-slate-700">
            Les informations importantes (dates, prix, réservation) sont verrouillées.
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500">Réservation</div>
              <div className="mt-2 text-sm space-y-1">
                <div>
                  <b>Nom</b> : {booking.full_name}
                </div>
                <div>
                  <b>Email</b> : {booking.email}
                </div>
                {booking.phone ? (
                  <div>
                    <b>Téléphone</b> : {booking.phone}
                  </div>
                ) : null}
                <div className="mt-2">
                  <b>Dates</b> : {formatDateFR(booking.arrival_date)} → {formatDateFR(booking.departure_date)}
                </div>
                {booking?.pricing?.total != null ? (
                  <div>
                    <b>Total</b> : {money(booking.pricing.total)}
                  </div>
                ) : null}
                {expectedOccupants ? (
                  <div>
                    <b>Personnes</b> : {expectedOccupants}
                    {booking.animals_count ? ` • Animaux : ${booking.animals_count}` : ""}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500">Votre adresse postale</div>

              <div className="mt-2 space-y-2">
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Adresse (ligne 1) *"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  disabled={isSigned}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Complément (optionnel)"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  disabled={isSigned}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="Code postal *"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    disabled={isSigned}
                  />
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="Ville *"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isSigned}
                  />
                </div>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Pays *"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isSigned}
                />
              </div>
            </div>
          </div>

          {/* CONTRAT ENTIER */}
          <div className="mt-6 rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-slate-500">Contrat (à lire)</div>

            <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-[14px] leading-6 text-slate-900 max-h-[55vh] overflow-auto">
              <div className="font-semibold mb-3">CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS —</div>

              <div className="font-semibold">1) Parties</div>
              <div className="mt-1">
                <div>
                  <b>Propriétaire (Bailleur)</b>
                </div>
                <div>Nom / Prénom : []</div>
                <div>Adresse : []</div>
                <div>E-mail : []</div>
                <div>Téléphone : []</div>

                <div className="mt-3">
                  <b>Locataire</b>
                </div>
                <div>Nom / Prénom : {booking.full_name}</div>
                <div>Adresse : (renseignée ci-dessus)</div>
                <div>E-mail : {booking.email}</div>
                <div>Téléphone : {booking.phone || "—"}</div>

                <div className="mt-2">
                  Le locataire déclare être majeur et avoir la capacité de contracter.
                </div>
              </div>

              <div className="mt-5 font-semibold">2) Logement loué</div>
              <div className="mt-1">
                <div>Désignation : Location saisonnière meublée</div>
                <div>Adresse du logement : [____________________]</div>
                <div>Capacité maximale : 8 personnes (voir Article 11).</div>
                <div>
                  Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en
                  prévaloir comme résidence principale.
                </div>
                <div className="mt-2">
                  Annexes (faisant partie intégrante du contrat) :
                </div>
                <div>Annexe 1 : État descriptif du logement (repris du site)</div>
                <div>Annexe 2 : Inventaire / liste équipements (repris du site)</div>
                <div>Annexe 3 : Règlement intérieur (repris et signé)</div>
                <div>Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)</div>
              </div>

              <div className="mt-5 font-semibold">3) Durée — Dates — Horaires</div>
              <div className="mt-1">
                <div>
                  Période : du {formatDateFR(booking.arrival_date)} au {formatDateFR(booking.departure_date)} pour{" "}
                  {booking?.pricing?.nights ?? "X"} nuits.
                </div>
                <div className="mt-2 font-semibold">Horaires standard (selon ton site)</div>
                <div>Arrivée (check-in) : entre 16h et 18h</div>
                <div>Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)</div>
                <div className="mt-2 font-semibold">Options (si accord préalable et selon disponibilités) :</div>
                <div>Arrivée début de journée : +70€</div>
                <div>Départ fin de journée : +70€</div>
              </div>

              <div className="mt-5 font-semibold">4) Prix — Taxes — Prestations</div>
              <div className="mt-1">
                <div>
                  Prix total du séjour : {total != null ? money(total) : "[____ €]"} comprenant :
                </div>
                <div>Hébergement : [____ €]</div>
                <div>Forfait ménage : 100€</div>
                <div>Options éventuelles : [____ €]</div>
                <div>Taxe de séjour : [____ €] (si applicable / selon règles locales)</div>
              </div>

              <div className="mt-5 font-semibold">5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)</div>
              <div className="mt-1">
                <div>
                  Mode de paiement : virement bancaire uniquement. Aucun paiement par chèque n’est accepté.
                </div>
                <div className="mt-2 font-semibold">5.1 Acompte (30%)</div>
                <div>
                  Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit{" "}
                  {acompte30 != null ? money(acompte30) : "[____ €]"}.
                </div>
                <div>
                  ✅ Les parties conviennent expressément que la somme versée à la réservation constitue un{" "}
                  <b>ACOMPTE</b> et non des arrhes.
                </div>
                <div className="mt-2 font-semibold">5.2 Solde</div>
                <div>
                  Le solde, soit {solde70 != null ? money(solde70) : "[____ €]"}, doit être réglé au plus tard 7
                  jours avant l’entrée dans les lieux.
                </div>
                <div>
                  À défaut de paiement du solde dans ce délai, et sans réponse dans les 48h suivant l’e-mail de
                  relance, le propriétaire pourra considérer la réservation comme annulée par le locataire,
                  l’acompte restant acquis au propriétaire.
                </div>
              </div>

              <div className="mt-5 font-semibold">6) Formation du contrat — Réservation</div>
              <div className="mt-1">
                <div>La réservation devient effective dès réception :</div>
                <div>du présent contrat signé, et</div>
                <div>de l’acompte de 30%.</div>
                <div>Le solde reste exigible selon l’Article 5.2.</div>
              </div>

              <div className="mt-5 font-semibold">7) Absence de droit de rétractation</div>
              <div className="mt-1">
                <div>
                  Le locataire est informé que, pour une prestation d’hébergement fournie à une date déterminée,
                  il ne bénéficie pas d’un droit de rétractation.
                </div>
                <div>➡️ Les conditions d’annulation applicables sont celles prévues à l’Article 8.</div>
              </div>

              <div className="mt-5 font-semibold">8) Annulation / Non-présentation / Séjour écourté</div>
              <div className="mt-1">
                <div className="font-semibold">8.1 Annulation par le locataire</div>
                <div>Toute annulation doit être notifiée par écrit (e-mail + recommandé conseillé).</div>
                <div>a) Quel que soit le motif, l’acompte de 30% reste définitivement acquis au propriétaire.</div>
                <div>
                  b) À compter du paiement du solde (J-7 avant l’arrivée), aucun remboursement ne sera effectué,
                  quel que soit le motif d’annulation ou d’empêchement, et le locataire reste redevable de la
                  totalité du séjour.
                </div>
                <div>c) Si le séjour est écourté, aucun remboursement n’est dû.</div>

                <div className="mt-2 font-semibold">8.2 Non-présentation (“no-show”)</div>
                <div>Si le locataire ne se manifeste pas et n’a pas convenu d’une arrivée différée :</div>
                <div>à partir de minuit (00h00) le jour d’arrivée, l’entrée dans les lieux n’est plus possible ;</div>
                <div>
                  si le locataire ne donne aucune nouvelle avant le lendemain 10h, le propriétaire peut considérer
                  la réservation comme annulée, disposer du logement, et conserver les sommes versées (hors taxe
                  de séjour si non due).
                </div>
              </div>

              <div className="mt-5 font-semibold">9) Annulation par le propriétaire</div>
              <div className="mt-1">
                <div>
                  En cas d’annulation par le propriétaire (hors force majeure), celui-ci remboursera au locataire
                  l’intégralité des sommes effectivement versées dans un délai de 7 jours.
                </div>
                <div>Aucune indemnité forfaitaire supplémentaire n’est due.</div>
              </div>

              <div className="mt-5 font-semibold">10) Force majeure</div>
              <div className="mt-1">
                <div>
                  Aucune des parties ne pourra être tenue responsable si l’exécution du contrat est empêchée par un
                  événement répondant à la définition de la force majeure (événement échappant au contrôle,
                  imprévisible et irrésistible).
                </div>
              </div>

              <div className="mt-5 font-semibold">11) État des lieux — Ménage — Entretien</div>
              <div className="mt-1">
                <div>
                  Un état des lieux contradictoire est signé à l’arrivée et au départ (Annexe 4).
                </div>
                <div>
                  Le ménage de fin de séjour est assuré par le propriétaire dans la limite d’un usage normal.
                </div>
                <div>
                  Le barbecue/plancha doivent être rendus propres. Les frais de remise en état, nettoyage
                  exceptionnel, ou dégradations peuvent être facturés.
                </div>
              </div>

              <div className="mt-5 font-semibold">12) Dépôt de garantie (caution) — 500€ (en liquide à l’arrivée)</div>
              <div className="mt-1">
                <div>Un dépôt de garantie de 500€ est demandé en liquide à l’arrivée.</div>
                <div>
                  Il est restitué après l’état des lieux de sortie, déduction faite des sommes dues au titre :
                </div>
                <div>dégradations, pertes, casse, nettoyage anormal, non-respect du règlement intérieur.</div>
                <div>
                  En cas de retenue, le propriétaire pourra fournir, selon le cas, photos + devis/factures justifiant
                  la retenue.
                </div>
              </div>

              <div className="mt-5 font-semibold">13) Identité du locataire</div>
              <div className="mt-1">
                <div>
                  À l’arrivée, le locataire s’engage à présenter une pièce d’identité au nom de la personne ayant
                  réservé, uniquement pour vérification d’identité.
                </div>
                <div>Aucun numéro de pièce n’est relevé ni conservé.</div>
              </div>

              <div className="mt-5 font-semibold">14) Capacité — Personnes supplémentaires — Visiteurs</div>
              <div className="mt-1">
                <div>Capacité maximale : 8 personnes.</div>
                <div>
                  Toute personne supplémentaire non autorisée peut entraîner la résiliation immédiate sans
                  remboursement.
                </div>
                <div>Supplément : 50€/personne/nuit et 50€/personne en journée (même sans nuitée), selon accord préalable.</div>
              </div>

              <div className="mt-5 font-semibold">15) Animaux</div>
              <div className="mt-1">
                <div>Animaux acceptés selon conditions.</div>
                <div>Supplément : 10€ par chien et par nuit (à régler à l’arrivée, sauf indication contraire).</div>
                <div>
                  Le locataire s’engage à maintenir la propreté, éviter toute dégradation et ramasser les déjections
                  à l’extérieur.
                </div>
              </div>

              <div className="mt-5 font-semibold">16) Caméras (information)</div>
              <div className="mt-1">
                <div>
                  Le locataire est informé de la présence de caméras uniquement sur les accès extérieurs (entrée/accès), à des fins de sécurité.
                </div>
                <div>Aucune caméra n’est présente à l’intérieur du logement.</div>
              </div>

              <div className="mt-5 font-semibold">17) Assurance</div>
              <div className="mt-1">
                <div>
                  Le locataire est responsable des dommages survenant de son fait et déclare être couvert par une assurance responsabilité civile villégiature (ou équivalent).
                </div>
                <div>Il est conseillé de souscrire une assurance annulation.</div>
              </div>

              <div className="mt-5 font-semibold">18) Utilisation paisible — Règlement intérieur</div>
              <div className="mt-1">
                <div>
                  Le locataire s’engage à une jouissance paisible des lieux et au respect du Règlement intérieur (Annexe 3), dont la validation conditionne la location.
                </div>
              </div>

              <div className="mt-5 font-semibold">19) Cession / Sous-location</div>
              <div className="mt-1">
                <div>
                  La location ne peut bénéficier à des tiers, sauf accord écrit du propriétaire. Toute infraction peut entraîner résiliation immédiate sans remboursement.
                </div>
              </div>

              <div className="mt-5 font-semibold">20) Litiges</div>
              <div className="mt-1">
                <div>
                  Contrat entre particuliers. En cas de difficulté, les parties recherchent une solution amiable.
                </div>
                <div>À défaut, le litige relèvera des juridictions compétentes selon les règles de droit commun.</div>
              </div>

              <div className="mt-5 font-semibold">Signatures</div>
              <div className="mt-1">
                <div>Fait à [ville], le [date].</div>
                <div>En 2 exemplaires.</div>
                <div className="mt-2">
                  Le Propriétaire (signature précédée de la mention “Lu et approuvé”) :
                </div>
                <div>[____________________]</div>
                <div className="mt-2">
                  Le Locataire (signature précédée de la mention “Lu et approuvé”) :
                </div>
                <div>[____________________]</div>
              </div>

              <div className="mt-6 font-semibold">ANNEXE 3 — RÈGLEMENT INTÉRIEUR (à signer)</div>
              <div className="mt-1">
                (On colle ici ton règlement complet + signature “Lu et approuvé” du locataire.)
              </div>

              <div className="mt-6 font-semibold">✅ Structure du contrat (version actuelle — “ma base”)</div>
              <div className="mt-1">
                <div>Le contrat est structuré en articles + annexes, pour être lisible et juridiquement solide :</div>
                <div className="mt-2">
                  <b>A)</b> Identification des parties
                  <div>Propriétaire (bailleur) : identité + coordonnées</div>
                  <div>Locataire : identité + coordonnées</div>
                  <div>Déclaration de capacité à contracter</div>
                </div>
                <div className="mt-2">
                  <b>B)</b> Désignation de la location
                  <div>Nature : location saisonnière meublée</div>
                  <div>Adresse / capacité / usage (résidence de vacances)</div>
                </div>
                <div className="mt-2">
                  <b>C)</b> Durée — Dates — Horaires
                  <div>Dates du séjour + nombre de nuits</div>
                  <div>Horaires conformes au site : arrivée 16h–18h • départ 10h max</div>
                  <div>Options possibles : arrivée début de journée (+70€) / départ fin de journée (+70€) selon disponibilité</div>
                </div>
                <div className="mt-2">
                  <b>D)</b> Prix — Taxes — Prestations
                  <div>Détail du prix total</div>
                  <div>Forfait ménage fixe : 100€</div>
                  <div>Taxe de séjour (si applicable) + options éventuelles</div>
                </div>
                <div className="mt-2">
                  <b>E)</b> Paiement (virement uniquement)
                  <div>Paiement par RIB uniquement (pas de chèque)</div>
                  <div>Acompte 30% : qualifié explicitement comme acompte (et non arrhes)</div>
                  <div>Solde à payer au plus tard 7 jours avant l’arrivée</div>
                </div>
                <div className="mt-2">
                  <b>F)</b> Réservation / engagement
                  <div>Réservation effective à réception : contrat signé + acompte payé</div>
                  <div>Le solde reste exigible selon les délais prévus</div>
                </div>
                <div className="mt-2">
                  <b>G)</b> Pas de droit de rétractation
                  <div>Mention spécifique à l’hébergement à date déterminée</div>
                  <div>Renvoi clair aux conditions d’annulation</div>
                </div>
                <div className="mt-2">
                  <b>H)</b> Annulation / No-show / séjour écourté (protection maximale)
                  <div>Acompte : non remboursable</div>
                  <div>Après paiement du solde (J-7) : aucun remboursement, quel que soit le motif</div>
                  <div>No-show : entrée impossible à partir de minuit, règles de disposition du logement ensuite</div>
                </div>
                <div className="mt-2">
                  <b>I)</b> Annulation par le propriétaire
                  <div>Remboursement intégral des sommes versées</div>
                  <div>Pas d’indemnité forfaitaire</div>
                </div>
                <div className="mt-2">
                  <b>J)</b> État des lieux / entretien / ménage
                  <div>État des lieux d’entrée + sortie signé</div>
                  <div>Conditions ménage + remise en état si abus/dégradations</div>
                </div>
                <div className="mt-2">
                  <b>K)</b> Caution / dépôt de garantie
                  <div>Caution : 500€ en liquide à l’arrivée</div>
                  <div>Restitution après état des lieux de sortie</div>
                  <div>Retenues possibles (dégradations/pertes/ménage anormal), justificatifs possibles (photos + devis/factures si nécessaire)</div>
                </div>
                <div className="mt-2">
                  <b>L)</b> Vérification d’identité
                  <div>À l’arrivée : présentation d’une pièce d’identité au nom du réservant</div>
                  <div>Aucun numéro de pièce relevé</div>
                </div>
                <div className="mt-2">
                  <b>M)</b> Capacité / personnes supplémentaires / visiteurs
                  <div>Max 8 personnes</div>
                  <div>Surcoûts : 50€/pers/nuit + 50€/visiteur journée (même sans nuitée)</div>
                  <div>Interdiction personnes non déclarées</div>
                </div>
                <div className="mt-2">
                  <b>N)</b> Animaux
                  <div>Acceptés sous conditions</div>
                  <div>Supplément : 10€/chien/nuit (à régler à l’arrivée)</div>
                </div>
                <div className="mt-2">
                  <b>O)</b> Caméras
                  <div>Présence de caméras uniquement sur les accès extérieurs (information obligatoire)</div>
                </div>
                <div className="mt-2">
                  <b>P)</b> Assurance
                  <div>Responsabilité civile villégiature conseillée / exigée</div>
                </div>
                <div className="mt-2">
                  <b>Q)</b> Utilisation paisible + règlement intérieur
                  <div>Respect du règlement intérieur obligatoire</div>
                  <div>Interdictions et règles détaillées</div>
                </div>
                <div className="mt-2">
                  <b>R)</b> Cession / sous-location
                  <div>Interdite sans accord écrit</div>
                </div>
                <div className="mt-2">
                  <b>S)</b> Litiges
                  <div>Recherche d’accord amiable</div>
                  <div>Compétence selon règles de droit commun</div>
                </div>

                <div className="mt-4 font-semibold">2) Annexes (très important)</div>
                <div className="mt-1">
                  <div>Le contrat est complété par des annexes qui font partie intégrante du dossier :</div>
                  <div>Annexe 1 — État descriptif du logement : informations détaillées (surface, équipements, prestations), pouvant être repris automatiquement depuis le site</div>
                  <div>Annexe 2 — Inventaire : liste équipements/objets, pouvant aussi être générée depuis la base du site</div>
                  <div>Annexe 3 — Règlement intérieur : le règlement complet à valider avant location</div>
                  <div>Annexe 4 — État des lieux d’entrée / sortie : document signé sur place</div>
                </div>
              </div>
            </div>
          </div>

          {/* OCCUPANTS */}
          <div className="mt-6 rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Personnes présentes pendant la location (Nom, Prénom, Âge)
            </div>

            <div className="mt-3 space-y-2">
              {occupants.map((o, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-5 rounded-lg border px-3 py-2"
                    placeholder="Prénom *"
                    value={o.first_name}
                    onChange={(e) => updateOcc(i, "first_name", e.target.value)}
                    disabled={isSigned}
                  />
                  <input
                    className="col-span-5 rounded-lg border px-3 py-2"
                    placeholder="Nom *"
                    value={o.last_name}
                    onChange={(e) => updateOcc(i, "last_name", e.target.value)}
                    disabled={isSigned}
                  />
                  <input
                    className="col-span-2 rounded-lg border px-3 py-2"
                    placeholder="Âge *"
                    value={o.age}
                    onChange={(e) => updateOcc(i, "age", e.target.value)}
                    disabled={isSigned}
                  />

                  {!isSigned && occupants.length > 1 ? (
                    <button
                      type="button"
                      className="col-span-12 text-left text-sm text-red-600 hover:underline"
                      onClick={() => removeOcc(i)}
                    >
                      Supprimer cette personne
                    </button>
                  ) : null}
                </div>
              ))}

              {!isSigned ? (
                <button
                  type="button"
                  className="text-sm text-blue-700 hover:underline disabled:opacity-50"
                  onClick={addOcc}
                  disabled={expectedOccupants != null && occupants.length >= expectedOccupants}
                >
                  + Ajouter une personne
                </button>
              ) : null}
            </div>
          </div>

          {/* SIGNATURE */}
          <div className="mt-6 rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-slate-500">Signature</div>

            {isSigned ? (
              <p className="mt-2 text-green-700 font-medium">Contrat déjà signé ✅</p>
            ) : (
              <label className="mt-3 flex gap-2 items-start text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  J’ai lu et j’accepte le contrat. Je certifie que les informations sont exactes.
                </span>
              </label>
            )}

            {!occupantsCountOk ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {expectedOccupants
                  ? `Vous devez renseigner exactement ${expectedOccupants} personne(s), comme dans votre demande.`
                  : "Ajoutez au moins une personne (nom, prénom, âge)."}
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Contrat envoyé ✅ (un email de confirmation a été envoyé).
              </div>
            ) : null}

            {!isSigned ? (
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-3 font-semibold disabled:opacity-60"
                onClick={submit}
                disabled={loading || !canSubmit}
              >
                {loading ? "Envoi…" : "Signer et envoyer le contrat"}
              </button>
            ) : null}

            <div className="mt-3 text-xs text-slate-500">
              En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
