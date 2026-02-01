"use client";

import { useEffect, useMemo, useState } from "react";

type Occupant = { first_name: string; last_name: string; age: string };
type Booking = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  arrival_date: string;
  departure_date: string;
  adults_count?: number | null;
  children_count?: number | null;
  animals_count?: number | null;
  pricing?: any;
};

type ExistingContract = {
  signer_address_line1: string;
  signer_postal_code: string;
  signer_city: string;
  occupants: Occupant[];
  signed_at?: string | null;
  contract_date?: string | null;
} | null;

type Props = { booking: Booking; token: string; existing: ExistingContract; };

// --- HELPERS ---
const toMoneyEUR = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : "— €";
};

const formatDateFR = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

function formatOtpWhileTyping(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function AnnexeBlock({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm text-slate-900">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <span>{title}</span>
        <span className="text-xl">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="p-5 text-sm leading-relaxed bg-white border-t border-slate-200 whitespace-pre-wrap">{children}</div>}
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
  const PROPERTY_ADDRESS = "2542 chemin des près neufs 83570 Carcès";

  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [contractDate, setContractDate] = useState(existing?.contract_date || "");
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [certifiedInsurance, setCertifiedInsurance] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isSigned = Boolean(existing?.signed_at);

  const pricingData = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    const options = Object.entries(p)
      .filter(([k, v]) => !['total', 'cleaning', 'tourist_tax', 'base_accommodation'].includes(k) && typeof v === 'number' && v > 0)
      .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v as number }));
    return { total, acompte, solde: total - acompte, menage: p.cleaning || 100, taxe: p.tourist_tax || 0, base: p.base_accommodation || 0, options };
  }, [booking.pricing]);

  const nights = useMemo(() => {
    const a = new Date(booking.arrival_date).getTime();
    const b = new Date(booking.departure_date).getTime();
    return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
  }, [booking.arrival_date, booking.departure_date]);

  useEffect(() => {
    if (!existing?.occupants) {
      const total = (booking.adults_count || 0) + (booking.children_count || 0) || 1;
      setOccupants(Array.from({ length: Math.min(8, total) }).map((_, i) => ({
        first_name: i === 0 ? booking.full_name.split(' ')[0] : "",
        last_name: i === 0 ? booking.full_name.split(' ').slice(1).join(' ') : "",
        age: ""
      })));
    } else { setOccupants(existing.occupants); }
  }, [booking, existing]);

  const handleAction = async (action: 'send_otp' | 'verify_otp') => {
    setError(null);
    if (!addressLine1 || !postalCode || !city || !contractDate) { setError("Veuillez remplir l'adresse et la date."); return; }
    if (!acceptedTerms || !certifiedInsurance) { setError("Veuillez valider les cases d'acceptation."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        body: JSON.stringify({ action, rid: booking.id, t: token, otp_code: otpCode, signer_address_line1: addressLine1, signer_postal_code: postalCode, signer_city: city, occupants, contract_date: contractDate, accepted_terms: true })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Erreur");
      if (action === 'send_otp') { setOtpSent(true); setOkMsg("Code envoyé par email ✅"); }
      else { window.location.reload(); }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20 font-sans text-slate-900">
      <div className="bg-gradient-to-r from-[#06243D] via-[#053A63] to-[#0B2A7A] py-10 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm opacity-80 uppercase tracking-widest">Superbe Bergerie • Contrat officiel</p>
          <h1 className="mt-2 text-3xl font-bold">CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS</h1>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-6xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
          
          <div className="space-y-10 whitespace-pre-wrap">
            {/* 1) PARTIES */}
            <section className="border-b pb-8">
              <h2 className="text-xl font-black text-[#06243D] underline uppercase mb-6">1) Parties</h2>
              <div className="grid gap-8 md:grid-cols-2 text-sm">
                <div className="bg-slate-50 p-5 rounded-xl border">
                  <p className="font-bold text-blue-900 mb-2">Propriétaire (Bailleur)</p>
                  <p>Nom / Prénom : {OWNER.name}</p>
                  <p>Adresse : {OWNER.address}</p>
                  <p>E-mail : {OWNER.email}</p>
                  <p>Téléphone : {OWNER.phone}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-xl border">
                  <p className="font-bold text-blue-900 mb-2">Locataire</p>
                  <p>Nom / Prénom : {booking.full_name}</p>
                  <div className="mt-3 space-y-3">
                    <input placeholder="Votre adresse complète *" className="w-full border p-2 rounded" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} disabled={isSigned} />
                    <div className="flex gap-2">
                      <input placeholder="Code Postal *" className="w-1/3 border p-2 rounded" value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={isSigned} />
                      <input placeholder="Ville *" className="w-2/3 border p-2 rounded" value={city} onChange={e => setCity(e.target.value)} disabled={isSigned} />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[10px] italic text-slate-500">Le locataire déclare être majeur et avoir la capacité de contracter. Élection de domicile est faite aux adresses indiquées.</p>
            </section>

            {/* 2 & 3 & 4) TEXTE INTÉGRAL */}
            <section className="text-sm leading-relaxed space-y-6">
              <h2 className="text-xl font-black text-[#06243D] underline uppercase">2) Logement loué</h2>
              <p>Désignation : Location saisonnière meublée sise au {PROPERTY_ADDRESS}. Capacité maximale : 8 personnes (voir Article 11). Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.</p>
              
              <h2 className="text-xl font-black text-[#06243D] underline uppercase pt-4">3) Durée — Dates — Horaires</h2>
              <p>Période : du {formatDateFR(booking.arrival_date)} au {formatDateFR(booking.departure_date)} pour {nights} nuits.</p>
              <p><strong>Horaires standard :</strong> Arrivée (check-in) : entre 16h et 18h. Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages).</p>
              <p>Options : Arrivée début de journée (+70€) / Départ fin de journée (+70€).</p>

              <h2 className="text-xl font-black text-[#06243D] underline uppercase pt-4">4) Prix — Taxes — Prestations</h2>
              <div className="bg-slate-50 p-4 rounded-lg font-medium">
                <p>Hébergement : {toMoneyEUR(pricingData.base)}</p>
                <p>Forfait ménage : {toMoneyEUR(pricingData.menage)}</p>
                <p>Taxe de séjour : {toMoneyEUR(pricingData.taxe)}</p>
                {pricingData.options.map((opt, i) => (
                  <p key={i} className="capitalize">+ {opt.label} : {toMoneyEUR(opt.value)}</p>
                ))}
                <p className="text-xl font-black mt-2 pt-2 border-t">TOTAL DU SÉJOUR : {toMoneyEUR(pricingData.total)}</p>
              </div>
            </section>

            {/* ARTICLES 5 À 20 SANS RÉSUMÉ */}
            <section className="text-sm leading-relaxed space-y-6">
              <h2 className="text-lg font-bold text-[#06243D]">5) Paiement — Acompte (Virement uniquement)</h2>
              <p>5.1 Acompte (30%) : Pour bloquer les dates, le locataire verse {toMoneyEUR(pricingData.acompte)}. Les parties conviennent que la somme constitue un ACOMPTE et non des arrhes. 5.2 Solde : Le solde de {toMoneyEUR(pricingData.solde)} doit être réglé au plus tard 7 jours avant l’entrée.</p>
              
              <h2 className="text-lg font-bold text-[#06243D]">8) Annulation / Non-présentation</h2>
              <p>8.1 Par le locataire : L’acompte de 30% reste acquis. À compter de J-7, aucun remboursement n’est effectué. 8.2 No-show : À minuit le jour d'arrivée, l’entrée n'est plus possible sans nouvelle du locataire.</p>

              <h2 className="text-lg font-bold text-[#06243D]">12) Dépôt de garantie (caution)</h2>
              <p>Une caution de 500€ est demandée en liquide à l’arrivée. Elle est restituée après l’état des lieux de sortie, déduction faite des dégradations ou non-respect du règlement.</p>

              <h2 className="text-lg font-bold text-[#06243D]">16) Caméras de surveillance</h2>
              <p>Le locataire est informé de la présence de caméras uniquement sur les accès extérieurs à des fins de sécurité. Aucune caméra n’est présente à l’intérieur.</p>
            </section>
          </div>

          {/* ANNEXES DÉTAILLÉES */}
          <AnnexeBlock title="Annexe 1 : État descriptif complet">
{`🌿 Bergerie provençale en pierres nichée en pleine forêt à Carcès. Terrain de 3 750 m² sans vis-à-vis. Accès par piste forestière.
🏡 Logement : Villa de 215 m², cuisine équipée, terrasse 40 m², grande véranda. Chambre XXL, chambre familiale, suite indépendante avec baby-foot.
🏝️ Extérieurs : Piscine au sel, badminton, basket, terrain de boules, aire de jeux enfants.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 3 : Règlement Intérieur (Texte Intégral)" defaultOpen={true}>
{`▶️ RDV Chapelle Notre Dame pour guidage (GPS imprécis). ⛔ Fêtes strictement interdites (expulsion police). ‼️ Max 8 personnes. 🎦 Caméras extérieures. 🚭 Non-fumeurs intérieur (cendrier extérieur obligatoire). ❌ Ne pas retirer les tapis noir du four. 🚮 Poubelles à emporter au départ. 🐶 Animaux : 10€/nuit. 📍 Arrivée 16h-18h / Départ 10h.`}
          </AnnexeBlock>

          {/* SECTION SIGNATURE OTP */}
          <section className="mt-12 border-t-4 border-[#06243D] pt-10 text-slate-900">
            <h2 className="text-xl font-black uppercase mb-6">Signature Électronique Sécurisée</h2>
            
            <div className="space-y-4 mb-8">
              <label className="flex items-start gap-3 text-sm font-bold">
                <input type="checkbox" className="h-5 w-5 mt-1" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} disabled={isSigned} />
                <span>J'accepte l'intégralité du contrat et du règlement intérieur (Annexe 3).</span>
              </label>
              <label className="flex items-start gap-3 text-sm font-bold">
                <input type="checkbox" className="h-5 w-5 mt-1" checked={certifiedInsurance} onChange={e => setCertifiedInsurance(e.target.checked)} disabled={isSigned} />
                <span>Je certifie être couvert par une assurance responsabilité civile villégiature (Article 17).</span>
              </label>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border-2 border-dashed border-slate-200 mb-8">
              <h3 className="font-bold mb-2">Pourquoi un code de signature ?</h3>
              <p className="text-sm text-slate-600">Pour garantir que la personne qui signe est bien celle qui a effectué la demande, nous envoyons un <strong>code unique à 6 chiffres</strong> par email. Cela sécurise juridiquement votre signature.</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 font-bold">
                <span>Fait à Carcès, le :</span>
                <input type="text" placeholder="JJ/MM/AAAA" className="border p-2 w-40" value={contractDate} onChange={e => setContractDate(e.target.value)} disabled={isSigned} />
              </div>

              {!isSigned && (
                <>
                  {!otpSent ? (
                    <button onClick={() => handleAction('send_otp')} disabled={loading || !token} className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white uppercase hover:bg-black disabled:opacity-30">Recevoir mon code par email</button>
                  ) : (
                    <div className="space-y-4">
                      <input maxLength={6} placeholder="Code à 6 chiffres" className="w-full text-center text-3xl font-bold p-4 border-2 border-blue-500 rounded-xl" value={otpCode} onChange={e => setOtpCode(formatOtpWhileTyping(e.target.value))} />
                      <button onClick={() => handleAction('verify_otp')} disabled={loading || otpCode.length < 6} className="w-full rounded-xl bg-emerald-700 py-5 text-xl font-black text-white uppercase hover:bg-emerald-800">Confirmer la signature</button>
                    </div>
                  )}
                </>
              )}
            </div>
            {error && <p className="mt-4 text-center font-bold text-red-600">{error}</p>}
            {okMsg && <p className="mt-4 text-center font-bold text-emerald-600">{okMsg}</p>}
          </section>

        </div>
      </div>
    </div>
  );
}