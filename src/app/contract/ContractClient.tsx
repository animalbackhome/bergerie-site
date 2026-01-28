// src/app/contract/ContractClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import OtpSignature from "./OtpSignature";

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
    const v = o?.[k];
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

export default function ContractClient({ booking, token, existing }: Props) {
  const expectedCount = useMemo(() => expectedPeopleCount(booking), [booking]);

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

  const [contractDate, setContractDate] = useState<string>(existing?.contract_date || "");

  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isSigned = Boolean(existing?.signed_at);

  useEffect(() => {
    if (existing?.occupants?.length) {
      setOccupants(existing.occupants.map((o) => ({ ...o })));
      return;
    }

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

  const nights = useMemo(() => nightsBetween(booking.arrival_date, booking.departure_date), [booking.arrival_date, booking.departure_date]);

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

    const optionsDirect =
      pickNumber(p, ["options_total", "extras_total", "extras", "options", "addon_total", "add_ons_total"]) ?? null;

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

    let accommodationFixed = accommodation;
    if (accommodationFixed == null && total != null) {
      const computed = total - cleaning - options - touristTax;
      accommodationFixed = Number.isFinite(computed) && computed >= 0 ? round2(computed) : null;
    }

    const deposit30 = total != null ? round2(total * 0.3) : null;
    const solde = total != null && deposit30 != null ? round2(total - deposit30) : null;

    return { total, accommodation: accommodationFixed, cleaning, options, touristTax, deposit30, solde };
  }, [booking.pricing]);

  const priceTotal = useMemo(() => (pricingNumbers.total != null ? toMoneyEUR(pricingNumbers.total) : ""), [pricingNumbers.total]);

  // --- validation helpers ---
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

  function validateBeforeOtp(): { ok: true; contractDateNormalized: string } | { ok: false; error: string } {
    if (isSigned) return { ok: false, error: "Déjà signé." };

    if (!addressLine1.trim() || !postalCode.trim() || !city.trim() || !country.trim()) {
      return { ok: false, error: "Adresse incomplète." };
    }

    const parsed = parseContractDateFR(contractDate);
    if (!parsed.ok) {
      return { ok: false, error: "Merci de renseigner la date du contrat au format JJ/MM/AAAA (ou JJMMAAAA)." };
    }

    if (!acceptedTerms) {
      return { ok: false, error: "Vous devez accepter le contrat." };
    }

    if (occupants.length < 1) {
      return { ok: false, error: "Ajoutez au moins une personne (nom, prénom, âge)." };
    }

    if (occupants.length > maxOccupants) {
      return { ok: false, error: `Maximum ${maxOccupants} personne(s).` };
    }

    if (!allOccupantsFilled) {
      return { ok: false, error: "Merci de renseigner nom, prénom et âge pour chaque personne." };
    }

    return { ok: true, contractDateNormalized: parsed.normalized };
  }

  const validated = useMemo(() => validateBeforeOtp(), [
    isSigned,
    addressLine1,
    postalCode,
    city,
    country,
    contractDate,
    acceptedTerms,
    occupants,
    maxOccupants,
    allOccupantsFilled,
  ]);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-r from-[#06243D] via-[#053A63] to-[#0B2A7A]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-white/80 text-sm">Superbe bergerie • Contrat de location</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Contrat de location saisonnière</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-14">
        <div className="-mt-8 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <div className="text-sm text-slate-600">Les informations importantes (dates, prix, réservation) sont verrouillées.</div>

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
                  <span className="font-semibold">Dates :</span> {formatDateFR(booking.arrival_date)} → {formatDateFR(booking.departure_date)} ({nights} nuit(s))
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
                <input className={disabledInputClass} placeholder="Adresse (ligne 1) *" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} disabled={isSigned} />
                <input className={disabledInputClass} placeholder="Complément (optionnel)" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} disabled={isSigned} />
                <div className="grid grid-cols-2 gap-3">
                  <input className={disabledInputClass} placeholder="Code postal *" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={isSigned} />
                  <input className={disabledInputClass} placeholder="Ville *" value={city} onChange={(e) => setCity(e.target.value)} disabled={isSigned} />
                </div>
                <input className={disabledInputClass} placeholder="Pays *" value={country} onChange={(e) => setCountry(e.target.value)} disabled={isSigned} />
              </div>
            </div>
          </div>

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
                <div className="mt-2 text-xs text-amber-700">Format attendu : JJ/MM/AAAA (ou JJMMAAAA) — ex : 03/02/2026</div>
              )
            ) : null}
          </div>

          {/* ⚠️ Contrat texte : inchangé dans ton projet.
              Ici on ne le ré-imprime pas pour garder l'artifact léger.
              Dans ton repo, garde ton bloc contractText EXACT comme avant. */}

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
                    <button type="button" onClick={() => removeOccupant(i)} disabled={isSigned} className="text-xs text-slate-600 underline disabled:opacity-50">
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

              <div className="text-sm text-slate-600">Pour signer, toutes les personnes (nom, prénom, âge) doivent être renseignées.</div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold tracking-wide text-slate-500">SIGNATURE</div>

            <label className="mt-3 flex items-start gap-3 text-sm text-slate-900">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={isSigned} />
              <span>J’ai lu et j’accepte le contrat. Je certifie que les informations sont exactes.</span>
            </label>

            {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

            {!isSigned ? (
              <div className="mt-4">
                {validated.ok ? (
                  <OtpSignature
                    booking={booking as any}
                    token={token}
                    signer_address_line1={addressLine1}
                    signer_address_line2={addressLine2}
                    signer_postal_code={postalCode}
                    signer_city={city}
                    signer_country={country}
                    occupants={occupants}
                    contract_date={validated.contractDateNormalized}
                    accepted_terms={true}
                    disabled={false}
                    onSigned={() => {
                      // optional UI behavior
                    }}
                  />
                ) : (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {validated.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Contrat déjà signé ✅
              </div>
            )}

            <div className="mt-2 text-xs text-slate-500">
              En signant, vous ne pouvez pas modifier les dates, tarifs ou informations clés de la réservation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
