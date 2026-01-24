"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  arrival_date: string;
  departure_date: string;
  pricing?: any;
};

type ExistingContract = {
  booking_request_id: number;
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

export default function ContractClient({ booking, token, existing }: Props) {
  const isSigned = Boolean(existing?.signed_at);

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
    return [
      {
        first_name,
        last_name,
        age: "",
      },
    ];
  }, [existing, booking.full_name]);

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

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rid: booking.id,
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-white/50 p-6">
        <h1 className="text-2xl font-semibold">Contrat de location</h1>
        <p className="text-sm text-slate-600 mt-1">
          Les informations importantes (dates, prix, réservation) sont verrouillées.
        </p>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-slate-500">Réservation</div>
            <div className="mt-2 text-sm">
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
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase tracking-wide text-slate-500">Votre adresse postale</div>

            <div className="mt-2 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Adresse (ligne 1)"
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
                  placeholder="Code postal"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  disabled={isSigned}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Ville"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isSigned}
                />
              </div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Pays"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={isSigned}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border p-4 bg-white">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Personnes présentes pendant la location (Nom, Prénom, Âge)
          </div>

          <div className="mt-3 space-y-2">
            {occupants.map((o, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className="col-span-5 rounded-lg border px-3 py-2"
                  placeholder="Prénom"
                  value={o.first_name}
                  onChange={(e) => updateOcc(i, "first_name", e.target.value)}
                  disabled={isSigned}
                />
                <input
                  className="col-span-5 rounded-lg border px-3 py-2"
                  placeholder="Nom"
                  value={o.last_name}
                  onChange={(e) => updateOcc(i, "last_name", e.target.value)}
                  disabled={isSigned}
                />
                <input
                  className="col-span-2 rounded-lg border px-3 py-2"
                  placeholder="Âge"
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
                className="text-sm text-blue-700 hover:underline"
                onClick={addOcc}
              >
                + Ajouter une personne
              </button>
            ) : null}
          </div>
        </div>

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
              disabled={loading}
            >
              {loading ? "Envoi…" : "Signer et envoyer le contrat"}
            </button>
          ) : null}
        </div>

        <div className="mt-6 text-xs text-slate-500">
          En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
        </div>
      </div>
    </div>
  );
}
