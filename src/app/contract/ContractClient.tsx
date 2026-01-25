"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = {
  id: string | number; // uuid (string) ou legacy
  full_name: string;
  email: string;
  phone?: string;
  arrival_date: string;
  departure_date: string;
  nights?: number | null;
  pricing?: any; // on garde any pour ne pas casser ce qui existe
};

type ExistingContract = {
  booking_request_id: string | number;
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

function toRidString(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

/**
 * Essaie de retrouver le nombre de personnes demandé, sans casser le schéma existant.
 * (On cherche dans booking.pricing puis quelques variantes courantes)
 */
function getExpectedGuests(booking: Booking): number | null {
  const p: any = (booking as any)?.pricing ?? {};
  const candidates = [
    (booking as any)?.guests,
    (booking as any)?.guest_count,
    (booking as any)?.people,
    (booking as any)?.persons,
    p?.guests,
    p?.guest_count,
    p?.people,
    p?.persons,
    p?.nb_people,
    p?.nb_personnes,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function calcAcompte(total: any) {
  const n = Number(total);
  if (!Number.isFinite(n)) return null;
  const acompte = Math.round(n * 0.3 * 100) / 100;
  return acompte;
}

export default function ContractClient({ booking, token, existing }: Props) {
  const isSigned = Boolean(existing?.signed_at);

  // IMPORTANT: rid doit rester EXACTEMENT celui de l’URL / DB (UUID)
  const rid = useMemo(() => toRidString(booking?.id), [booking?.id]);

  const expectedGuests = useMemo(() => getExpectedGuests(booking), [booking]);

  const [address1, setAddress1] = useState(existing?.signer_address_line1 || "");
  const [address2, setAddress2] = useState(existing?.signer_address_line2 || "");
  const [zip, setZip] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [country, setCountry] = useState(existing?.signer_country || "France");

  const initialOccupants = useMemo(() => {
    if (existing?.occupants?.length) return existing.occupants;

    // Par défaut : la personne qui réserve (âge à compléter)
    const parts = (booking.full_name || "").trim().split(/\s+/);
    const first_name = parts.slice(0, -1).join(" ") || parts[0] || "";
    const last_name = parts.slice(-1).join(" ") || "";

    const base = [{ first_name, last_name, age: "" }];

    // Si on connait le nombre de personnes, on crée EXACTEMENT le bon nombre de lignes
    if (expectedGuests && expectedGuests > 1) {
      const extra = Array.from({ length: expectedGuests - 1 }).map(() => ({
        first_name: "",
        last_name: "",
        age: "",
      }));
      return [...base, ...extra];
    }

    return base;
  }, [existing, booking.full_name, expectedGuests]);

  const [occupants, setOccupants] = useState(initialOccupants);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Popup RIB après signature
  const [showRib, setShowRib] = useState(false);

  useEffect(() => {
    setOccupants(initialOccupants);
    setAccepted(false);
    setSuccess(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  function updateOcc(i: number, key: "first_name" | "last_name" | "age", value: string) {
    setOccupants((prev) => prev.map((o, idx) => (idx === i ? { ...o, [key]: value } : o)));
  }

  function addOcc() {
    // Si le nombre est imposé, on interdit l’ajout (exactement N personnes)
    if (expectedGuests) return;
    setOccupants((prev) => [...prev, { first_name: "", last_name: "", age: "" }]);
  }

  function removeOcc(i: number) {
    // Si le nombre est imposé, on interdit la suppression (exactement N personnes)
    if (expectedGuests) return;
    setOccupants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validateBeforeSubmit(): string | null {
    if (!rid) return "Missing rid";
    if (!accepted) return "Veuillez cocher la case d’acceptation.";
    if (!address1.trim()) return "Adresse (ligne 1) obligatoire.";
    if (!zip.trim()) return "Code postal obligatoire.";
    if (!city.trim()) return "Ville obligatoire.";
    if (!country.trim()) return "Pays obligatoire.";

    // Nombre de personnes EXACT
    if (expectedGuests && occupants.length !== expectedGuests) {
      return `Vous devez renseigner exactement ${expectedGuests} personne(s).`;
    }

    // Champs occupants obligatoires
    for (let i = 0; i < occupants.length; i++) {
      const o = occupants[i];
      if (!String(o.first_name || "").trim()) return `Prénom manquant (personne #${i + 1}).`;
      if (!String(o.last_name || "").trim()) return `Nom manquant (personne #${i + 1}).`;
      if (!String(o.age || "").trim()) return `Âge manquant (personne #${i + 1}).`;
    }

    return null;
  }

  async function submit() {
    setError(null);

    const v = validateBeforeSubmit();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // IMPORTANT: rid doit être une string UUID (pas number)
          rid,
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

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erreur inconnue");
      }

      setSuccess(true);
      setShowRib(true);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const total = booking?.pricing?.total;
  const acompte = calcAcompte(total);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-900 via-sky-800 to-slate-950">
      {/* Header bleu en haut (comme demandé) */}
      <div className="w-full bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-white/90 text-sm">Superbe bergerie • Contrat de location</div>
          <h1 className="text-white text-2xl md:text-3xl font-semibold mt-1">
            Contrat de location saisonnière
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl bg-white shadow-lg border border-white/40 overflow-hidden">
          <div className="p-6">
            <p className="text-sm text-slate-700">
              Les informations importantes (dates, prix, réservation) sont verrouillées.
            </p>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-slate-500">Réservation</div>
                <div className="mt-2 text-sm text-slate-900 space-y-1">
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
                    <b>Dates</b> : {formatDateFR(booking.arrival_date)} →{" "}
                    {formatDateFR(booking.departure_date)}
                  </div>
                  {booking?.pricing?.total != null ? (
                    <div>
                      <b>Total</b> : {money(booking.pricing.total)}
                    </div>
                  ) : null}
                  {expectedGuests ? (
                    <div>
                      <b>Nombre de personnes</b> : {expectedGuests}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Votre adresse postale
                </div>

                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Adresse (ligne 1) *"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    disabled={isSigned}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Complément (optionnel)"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    disabled={isSigned}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      placeholder="Code postal *"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      disabled={isSigned}
                    />
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      placeholder="Ville *"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={isSigned}
                    />
                  </div>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Pays *"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={isSigned}
                  />
                </div>
              </div>
            </div>

            {/* Contrat complet (lisible, mobile, pro) */}
            <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500">Contrat (à lire)</div>

              <div className="mt-3 text-slate-900 text-sm leading-relaxed space-y-4">
                <div>
                  <div className="font-semibold">1) Parties</div>
                  <div className="mt-2 space-y-1">
                    <div>
                      <b>Propriétaire (Bailleur)</b> : Superbe bergerie, forêt, piscine & lac (coordonnées
                      communiquées au locataire).
                    </div>
                    <div>
                      <b>Locataire</b> : <span className="font-medium">{booking.full_name}</span> —{" "}
                      <span className="font-medium">{booking.email}</span>
                      {booking.phone ? <> — {booking.phone}</> : null}
                    </div>
                    <div className="text-slate-700">
                      Le locataire déclare être majeur et avoir la capacité de contracter.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold">2) Logement loué</div>
                  <div className="mt-2 text-slate-800">
                    Désignation : Location saisonnière meublée. Capacité maximale : 8 personnes (voir
                    Article 14). Le logement est loué à titre de résidence de vacances.
                  </div>
                  <div className="mt-2 text-slate-800">
                    Annexes : (1) État descriptif (site) • (2) Inventaire (site) • (3) Règlement intérieur
                    (à signer) • (4) État des lieux entrée/sortie (sur place).
                  </div>
                </div>

                <div>
                  <div className="font-semibold">3) Durée — Dates — Horaires</div>
                  <div className="mt-2 text-slate-800">
                    Période : du <b>{formatDateFR(booking.arrival_date)}</b> au{" "}
                    <b>{formatDateFR(booking.departure_date)}</b>
                    {booking.nights != null ? <> pour <b>{booking.nights}</b> nuits</> : null}.
                  </div>
                  <div className="mt-2 text-slate-800">
                    Arrivée (check-in) : 16h–18h • Départ (check-out) : 10h max.
                    <div className="mt-1 text-slate-700">
                      Options : arrivée début de journée (+70€) / départ fin de journée (+70€) selon accord.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold">4) Prix — Taxes — Prestations</div>
                  <div className="mt-2 text-slate-800">
                    Prix total du séjour : <b>{total != null ? money(total) : "—"}</b> comprenant :
                    hébergement + forfait ménage 100€ + options éventuelles + taxe de séjour (si applicable).
                  </div>
                </div>

                <div>
                  <div className="font-semibold">5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)</div>
                  <div className="mt-2 text-slate-800 space-y-2">
                    <div>Mode de paiement : virement bancaire uniquement (aucun chèque).</div>
                    <div>
                      <b>5.1 Acompte (30%)</b> : pour bloquer les dates, le locataire verse un acompte de 30%
                      du prix total (acompte, et non arrhes).
                      {acompte != null ? (
                        <>
                          {" "}
                          Montant estimé : <b>{money(acompte)}</b>.
                        </>
                      ) : null}
                    </div>
                    <div>
                      <b>5.2 Solde</b> : le solde doit être réglé au plus tard 7 jours avant l’entrée dans
                      les lieux.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold">8) Annulation / Non-présentation / Séjour écourté</div>
                  <div className="mt-2 text-slate-800">
                    L’acompte reste acquis. Après paiement du solde (J-7), aucun remboursement n’est dû. En
                    cas de no-show, règles applicables selon le contrat complet.
                  </div>
                </div>

                <div>
                  <div className="font-semibold">12) Dépôt de garantie (caution) — 500€ (en liquide à l’arrivée)</div>
                  <div className="mt-2 text-slate-800">
                    Restitution après état des lieux de sortie, déduction faite des sommes dues en cas de
                    dégradations/pertes/casse/nettoyage anormal.
                  </div>
                </div>

                <div className="text-slate-700 text-xs">
                  Note : Le texte complet sera envoyé en PDF dans l’email de confirmation (signature en
                  ligne ci-dessous).
                </div>
              </div>
            </div>

            {/* Occupants */}
            <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Personnes présentes pendant la location (Nom, Prénom, Âge)
              </div>

              {expectedGuests ? (
                <div className="mt-2 text-sm text-slate-700">
                  Vous devez renseigner <b>exactement {expectedGuests}</b> personne(s).
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {occupants.map((o, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-12 md:col-span-5 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      placeholder="Prénom *"
                      value={o.first_name}
                      onChange={(e) => updateOcc(i, "first_name", e.target.value)}
                      disabled={isSigned}
                    />
                    <input
                      className="col-span-12 md:col-span-5 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      placeholder="Nom *"
                      value={o.last_name}
                      onChange={(e) => updateOcc(i, "last_name", e.target.value)}
                      disabled={isSigned}
                    />
                    <input
                      className="col-span-12 md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      placeholder="Âge *"
                      value={o.age}
                      onChange={(e) => updateOcc(i, "age", e.target.value)}
                      disabled={isSigned}
                    />

                    {!isSigned && !expectedGuests && occupants.length > 1 ? (
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

                {!isSigned && !expectedGuests ? (
                  <button
                    type="button"
                    className="text-sm text-blue-700 hover:underline"
                    onClick={addOcc}
                  >
                    + Ajouter une personne
                  </button>
                ) : null}
              </div>
            </div>

            {/* Signature */}
            <div className="mt-6 rounded-xl border border-slate-200 p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-slate-500">Signature</div>

              {isSigned ? (
                <p className="mt-2 text-green-700 font-medium">Contrat déjà signé ✅</p>
              ) : (
                <label className="mt-3 flex gap-2 items-start text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>J’ai lu et j’accepte le contrat. Je certifie que les informations sont exactes.</span>
                </label>
              )}

              {error ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                  Contrat envoyé ✅ (un email de confirmation a été envoyé).
                </div>
              ) : null}

              {!isSigned ? (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-3 font-semibold disabled:opacity-60"
                  onClick={submit}
                  disabled={loading}
                >
                  {loading ? "Envoi…" : "Signer et envoyer le contrat"}
                </button>
              ) : null}

              <div className="mt-4 text-xs text-slate-600">
                En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
              </div>
            </div>
          </div>
        </div>

        {/* Modal RIB après signature */}
        {showRib && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowRib(false)} />
            <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
              <div className="text-lg font-semibold text-slate-900">Acompte à régler (30%)</div>
              <div className="mt-2 text-sm text-slate-700">
                Merci ! Pour confirmer la réservation, merci d’effectuer le virement de l’acompte.
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 space-y-2">
                <div>
                  <b>Montant acompte</b> :{" "}
                  {acompte != null ? money(acompte) : "Montant à confirmer (prix non disponible)"}
                </div>
                <div className="text-slate-700 text-xs">
                  (Le montant exact sera aussi rappelé dans l’email.)
                </div>

                <div className="pt-2">
                  <b>RIB / IBAN</b> : <span className="text-slate-600">à renseigner ici (on le branchera ensuite depuis tes variables/env ou Supabase)</span>
                </div>
              </div>

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-900"
                  onClick={() => setShowRib(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
