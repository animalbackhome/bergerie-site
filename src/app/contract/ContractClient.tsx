"use client";

import { useEffect, useMemo, useState } from "react";

// --- TYPES ---
type Occupant = { first_name: string; last_name: string; age: string };
type Booking = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  arrival_date: string;
  departure_date: string;
  pricing?: any;
  adults_count?: number;
  children_count?: number;
};

type Props = { booking: Booking; token: string; existing: any; };

const toMoneyEUR = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : "— €";
};

const formatDateFR = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

// COMPOSANT ANNEXE LISIBLE
function AnnexeBlock({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-left font-bold text-slate-900"
      >
        <span>{title}</span>
        <span className="text-xl">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="p-4 text-sm leading-relaxed text-black bg-white">{children}</div>}
    </div>
  );
}

export default function ContractClient({ booking, token, existing }: Props) {
  const OWNER = {
    name: "Laurens Coralie",
    address: "2542 chemin des près neufs 83570 Carcès",
    email: "laurens-coralie@hotmail.com",
    phone: "0629465295",
  };

  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [contractDate, setContractDate] = useState(existing?.contract_date || "");
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    return { total, acompte, solde: total - acompte, menage: p.cleaning || 100, taxe: p.tourist_tax || 0, base: (total - (p.cleaning || 100) - (p.tourist_tax || 0)) };
  }, [booking.pricing]);

  useEffect(() => {
    if (!existing?.occupants) {
      const totalPeople = (booking.adults_count || 0) + (booking.children_count || 0) || 1;
      setOccupants(Array.from({ length: Math.min(8, totalPeople) }).map((_, i) => ({
        first_name: i === 0 ? booking.full_name.split(' ')[0] : "",
        last_name: i === 0 ? booking.full_name.split(' ').slice(1).join(' ') : "",
        age: ""
      })));
    }
  }, [booking]);

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* HEADER */}
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          {/* 1. PARTIES */}
          <section className="mb-10 border-b border-slate-200 pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">1) Les Parties</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Propriétaire</h3>
                <p className="font-bold text-slate-900">{OWNER.name}</p>
                <p className="text-slate-700">{OWNER.address}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Locataire</h3>
                <p className="font-bold text-slate-900 mb-3">{booking.full_name}</p>
                <div className="space-y-3">
                  <input placeholder="Votre Adresse complète *" className="w-full rounded-md border-slate-300 p-2 text-black bg-white border" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                  <div className="flex gap-2">
                    <input placeholder="Code Postal *" className="w-1/3 rounded-md border-slate-300 p-2 text-black bg-white border" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                    <input placeholder="Ville *" className="w-2/3 rounded-md border-slate-300 p-2 text-black bg-white border" value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. DATES */}
          <section className="mb-10 border-b border-slate-200 pb-8">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">2) Durée & Dates</h2>
            <div className="flex flex-wrap gap-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-900">
                Arrivée : {formatDateFR(booking.arrival_date)} (16h-18h)
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-900">
                Départ : {formatDateFR(booking.departure_date)} (10h max)
              </div>
            </div>
          </section>

          {/* 3. PRIX */}
          <section className="mb-10 border-b border-slate-200 pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">3) Prix & Paiement</h2>
            <div className="space-y-2 font-medium">
              <div className="flex justify-between"><span>Hébergement :</span><span>{toMoneyEUR(pricing.base)}</span></div>
              <div className="flex justify-between"><span>Forfait ménage :</span><span>{toMoneyEUR(pricing.menage)}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Taxe de séjour :</span><span>{toMoneyEUR(pricing.taxe)}</span></div>
              <div className="flex justify-between text-2xl font-black pt-2 text-[#06243D]">
                <span>TOTAL DU SÉJOUR :</span><span>{toMoneyEUR(pricing.total)}</span>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm text-orange-900 leading-relaxed">
              <strong>Conditions de paiement :</strong> Un acompte de 30% ({toMoneyEUR(pricing.acompte)}) est dû immédiatement à la signature pour bloquer vos dates. Le solde ({toMoneyEUR(pricing.solde)}) est à régler par virement 7 jours avant votre arrivée.
            </div>
          </section>

          {/* 4. ANNEXES */}
          <section className="mb-10">
            <h2 className="mb-4 text-2xl font-extrabold text-[#06243D] underline">4) Annexes</h2>
            <AnnexeBlock title="Annexe 1 : Descriptif & Services">
              <p>Bergerie provençale de 215m² sur un terrain de 3750m². Piscine au sel, Starlink (Internet haut débit), terrain de pétanque, badminton.</p>
            </AnnexeBlock>
            <AnnexeBlock title="Annexe 2 : Règlement Intérieur">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Fêtes strictement interdites.</strong></li>
                <li>Capacité limitée à 8 personnes.</li>
                <li>Animaux acceptés (supplément 10€/nuit).</li>
                <li>Logement non-fumeur à l'intérieur.</li>
              </ul>
            </AnnexeBlock>
          </section>

          {/* 5. OCCUPANTS */}
          <section className="mb-10 rounded-xl bg-slate-50 p-6 border border-slate-200">
            <h2 className="mb-6 text-xl font-bold text-slate-900">5) Personnes présentes (Nom, Prénom, Âge)</h2>
            <div className="space-y-3">
              {occupants.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Prénom" className="w-1/3 rounded border border-slate-300 p-2 text-black bg-white" value={o.first_name} onChange={e => {
                    const n = [...occupants]; n[i].first_name = e.target.value; setOccupants(n);
                  }} />
                  <input placeholder="Nom" className="w-1/3 rounded border border-slate-300 p-2 text-black bg-white" value={o.last_name} onChange={e => {
                    const n = [...occupants]; n[i].last_name = e.target.value; setOccupants(n);
                  }} />
                  <input placeholder="Âge" className="w-1/4 rounded border border-slate-300 p-2 text-black bg-white" value={o.age} onChange={e => {
                    const n = [...occupants]; n[i].age = e.target.value; setOccupants(n);
                  }} />
                </div>
              ))}
            </div>
          </section>

          {/* SIGNATURE */}
          <div className="mt-12 border-t-2 border-[#06243D] pt-10">
            <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-base font-bold text-black leading-tight">
                Je déclare avoir pris connaissance du contrat et des annexes, j'en accepte les conditions et je certifie l'exactitude des informations fournies.
              </label>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 font-bold text-black">
                <span>Fait à Carcès, le :</span>
                <input type="text" placeholder="JJ/MM/AAAA" className="rounded border border-slate-400 p-2 w-40 text-black bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} />
              </div>

              <button 
                disabled={!acceptedTerms || !token}
                className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white shadow-xl hover:bg-black disabled:opacity-30 uppercase tracking-widest"
              >
                Signer et Recevoir mon code
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}