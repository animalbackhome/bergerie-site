"use client";

import { useEffect, useMemo, useState } from "react";

// --- TYPES ET HELPERS ---
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
  booking_request_id: string;
  signer_address_line1: string;
  signer_address_line2?: string | null;
  signer_postal_code: string;
  signer_city: string;
  signer_country: string;
  occupants: Occupant[];
  signed_at?: string | null;
  contract_date?: string | null;
} | null;

type Props = { booking: Booking; token: string; existing: ExistingContract; };

// Helper pour formater l'argent
const toMoneyEUR = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : "— €";
};

// Helper pour les dates
const formatDateFR = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

// --- COMPOSANT ANNEXE (Pour le design) ---
function AnnexeBlock({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left font-semibold text-slate-800"
      >
        <span>{title}</span>
        <span className="text-xl">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="p-4 text-sm leading-relaxed text-slate-700">{children}</div>}
    </div>
  );
}

export default function ContractClient({ booking, token, existing }: Props) {
  // CONFIG PROPRIÉTAIRE
  const OWNER = {
    name: "Laurens Coralie",
    address: "2542 chemin des près neufs 83570 Carcès",
    email: "laurens-coralie@hotmail.com",
    phone: "0629465295",
  };

  // ÉTATS FORMULAIRE
  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(existing?.signer_address_line2 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [country, setCountry] = useState(existing?.signer_country || "France");
  const [contractDate, setContractDate] = useState(existing?.contract_date || "");
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [signedOk, setSignedOk] = useState(false);

  const isSigned = Boolean(existing?.signed_at) || signedOk;

  // CALCULS PRIX
  const pricing = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    return {
      total,
      acompte,
      solde: total - acompte,
      menage: p.cleaning || 100,
      taxe: p.tourist_tax || 0,
      options: p.options_total || 0,
      base: p.base_accommodation || (total - (p.cleaning || 100) - (p.tourist_tax || 0) - (p.options_total || 0))
    };
  }, [booking.pricing]);

  const nights = useMemo(() => {
    const a = new Date(booking.arrival_date).getTime();
    const b = new Date(booking.departure_date).getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }, [booking.arrival_date, booking.departure_date]);

  // INITIALISATION OCCUPANTS
  useEffect(() => {
    if (existing?.occupants) {
      setOccupants(existing.occupants);
    } else {
      const totalPeople = (booking.adults_count || 0) + (booking.children_count || 0) || 1;
      setOccupants(Array.from({ length: Math.min(8, totalPeople) }).map((_, i) => ({
        first_name: i === 0 ? booking.full_name.split(' ')[0] : "",
        last_name: i === 0 ? booking.full_name.split(' ').slice(1).join(' ') : "",
        age: ""
      })));
    }
  }, [existing, booking]);

  // ACTIONS API
  const handleAction = async (action: 'send_otp' | 'verify_otp') => {
    setError(null);
    if (!addressLine1 || !postalCode || !city || !contractDate) {
      setError("Merci de remplir tous les champs obligatoires (*).");
      return;
    }
    if (!acceptedTerms) {
      setError("Vous devez accepter le contrat avant de signer.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        body: JSON.stringify({
          action,
          rid: booking.id,
          t: token,
          otp_code: otpCode,
          signer_address_line1: addressLine1,
          signer_address_line2: addressLine2,
          signer_postal_code: postalCode,
          signer_city: city,
          signer_country: country,
          occupants,
          contract_date: contractDate,
          accepted_terms: true
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Une erreur est survenue");
      
      if (action === 'send_otp') {
        setOtpSent(true);
        setOkMsg("Code envoyé par email !");
      } else {
        setSignedOk(true);
        setOkMsg("Contrat signé avec succès ✅");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER BLEU */}
      <div className="bg-gradient-to-r from-[#06243D] to-[#0B2A7A] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold">Contrat de Location Saisonnière</h1>
          <p className="mt-2 opacity-80">Bergerie Provençale • Carcès</p>
          {isSigned && <div className="mt-4 inline-block rounded-full bg-emerald-500 px-4 py-1 text-sm font-bold">Signé le {new Date().toLocaleDateString('fr-FR')} ✅</div>}
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-black/5">
          
          {/* SECTION 1 : PARTIES */}
          <section className="mb-8 border-b pb-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900 underline">1) Les Parties</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-bold text-[#0B2A7A]">Le Propriétaire</h3>
                <p className="text-sm mt-1">{OWNER.name}<br/>{OWNER.address}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-bold text-[#0B2A7A]">Le Locataire</h3>
                <p className="text-sm mt-1">{booking.full_name}<br/>{booking.email}</p>
                <div className="mt-4 space-y-2">
                  <input placeholder="Adresse *" className="w-full rounded border p-2 text-sm" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} disabled={isSigned} />
                  <div className="flex gap-2">
                    <input placeholder="CP *" className="w-1/3 rounded border p-2 text-sm" value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={isSigned} />
                    <input placeholder="Ville *" className="w-2/3 rounded border p-2 text-sm" value={city} onChange={e => setCity(e.target.value)} disabled={isSigned} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 : SEJOUR */}
          <section className="mb-8 border-b pb-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900 underline">2) Durée & Dates</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="rounded bg-blue-50 px-3 py-2"><strong>Arrivée :</strong> {formatDateFR(booking.arrival_date)} (16h-18h)</div>
              <div className="rounded bg-blue-50 px-3 py-2"><strong>Départ :</strong> {formatDateFR(booking.departure_date)} (10h max)</div>
              <div className="rounded bg-blue-50 px-3 py-2"><strong>Nuits :</strong> {nights}</div>
            </div>
          </section>

          {/* SECTION 3 : FINANCES */}
          <section className="mb-8 border-b pb-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900 underline">3) Prix & Paiement</h2>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y">
                <tr><td className="py-2">Hébergement</td><td className="py-2 text-right">{toMoneyEUR(pricing.base)}</td></tr>
                <tr><td className="py-2">Forfait ménage</td><td className="py-2 text-right">{toMoneyEUR(pricing.menage)}</td></tr>
                <tr><td className="py-2">Taxe de séjour</td><td className="py-2 text-right">{toMoneyEUR(pricing.taxe)}</td></tr>
                {pricing.options > 0 && <tr><td className="py-2">Options</td><td className="py-2 text-right">{toMoneyEUR(pricing.options)}</td></tr>}
                <tr className="font-bold text-lg"><td className="py-3">TOTAL DU SÉJOUR</td><td className="py-3 text-right">{toMoneyEUR(pricing.total)}</td></tr>
              </tbody>
            </table>
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-xs text-amber-900">
              <strong>Conditions :</strong> Un acompte de 30% ({toMoneyEUR(pricing.acompte)}) est dû à la signature. Le solde de 70% ({toMoneyEUR(pricing.solde)}) est dû 7 jours avant l'arrivée.
            </div>
          </section>

          {/* SECTION 4 : ANNEXES (DESIGN PROPRE) */}
          <section className="mb-8">
            <h2 className="mb-2 text-xl font-bold text-slate-900 underline">4) Annexes du contrat</h2>
            <p className="text-xs text-slate-500 italic">Cliquez sur chaque annexe pour consulter le détail complet.</p>
            
            <AnnexeBlock title="Annexe 1 : État Descriptif du Logement">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-bold">🌿 Cadre</h4>
                  <p>Bergerie de 215m² sur terrain de 3750m². Accès direct forêt et lac.</p>
                </div>
                <div>
                  <h4 className="font-bold">🏡 Équipements Clés</h4>
                  <p>Piscine au sel, Starlink (Fibre), Suite indépendante, Baby-foot.</p>
                </div>
              </div>
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 2 : Inventaire (Cuisine, Chambres, Loisirs)">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Cuisine :</strong> Four, Micro-ondes, Lave-vaisselle, Cafetières (filtre), Réfrigérateurs.</li>
                <li><strong>Loisirs :</strong> Terrain de boules, Badminton, Panier de basket, Jeux aquatiques.</li>
                <li><strong>Linge :</strong> Draps et serviettes de douche fournis (hors serviettes piscine).</li>
              </ul>
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 3 : Règlement Intérieur (À respecter strictement)" defaultOpen={true}>
              <div className="space-y-2 text-xs">
                <p>🚫 <strong>Fêtes :</strong> Strictement interdites (expulsion immédiate).</p>
                <p>👥 <strong>Capacité :</strong> 8 personnes maximum. Toute personne supplémentaire = 50€/nuit.</p>
                <p>🚭 <strong>Tabac :</strong> Interdit à l'intérieur. Cendriers obligatoires dehors (risque incendie).</p>
                <p>🐶 <strong>Animaux :</strong> Acceptés (10€/nuit). Déjections à ramasser impérativement.</p>
                <p>🧹 <strong>Ménage :</strong> Vaisselle faite et lave-vaisselle vidé. Poubelles emportées.</p>
              </div>
            </AnnexeBlock>
          </section>

          {/* SECTION 5 : OCCUPANTS */}
          <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
            <h2 className="mb-4 text-lg font-bold text-[#0B2A7A]">5) Liste des occupants</h2>
            <div className="space-y-3">
              {occupants.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Prénom" className="w-1/3 rounded border p-2 text-sm" value={o.first_name} onChange={e => {
                    const newOcc = [...occupants]; newOcc[i].first_name = e.target.value; setOccupants(newOcc);
                  }} disabled={isSigned} />
                  <input placeholder="Nom" className="w-1/3 rounded border p-2 text-sm" value={o.last_name} onChange={e => {
                    const newOcc = [...occupants]; newOcc[i].last_name = e.target.value; setOccupants(newOcc);
                  }} disabled={isSigned} />
                  <input placeholder="Âge" className="w-1/4 rounded border p-2 text-sm" value={o.age} onChange={e => {
                    const newOcc = [...occupants]; newOcc[i].age = e.target.value; setOccupants(newOcc);
                  }} disabled={isSigned} />
                </div>
              ))}
            </div>
          </section>

          {/* SIGNATURE */}
          <section className="mt-10 border-t pt-8">
            <div className="flex items-center gap-3 mb-6">
              <input type="checkbox" id="terms" className="h-5 w-5" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} disabled={isSigned} />
              <label htmlFor="terms" className="text-sm font-medium">Je certifie l'exactitude des informations et j'accepte les termes du contrat.</label>
            </div>

            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700">Fait à Carcès, le :</span>
                  <input type="text" placeholder="JJ/MM/AAAA" className="rounded border p-2 text-sm" value={contractDate} onChange={e => setContractDate(e.target.value)} disabled={isSigned} />
               </div>

               {!isSigned && (
                 <>
                   {!otpSent ? (
                     <button 
                      onClick={() => handleAction('send_otp')}
                      disabled={loading || !token}
                      className="w-full rounded-xl bg-[#0B2A7A] py-4 font-bold text-white hover:bg-[#06243D] disabled:opacity-50"
                     >
                       {loading ? "Chargement..." : "RECEVOIR MON CODE DE SIGNATURE"}
                     </button>
                   ) : (
                     <div className="space-y-4 rounded-xl border-2 border-dashed border-blue-200 p-6">
                        <p className="text-center text-sm font-bold text-blue-800">Saisissez le code à 6 chiffres reçu par email :</p>
                        <input 
                          maxLength={6}
                          className="w-full text-center text-3xl font-bold tracking-widest border-b-2 border-blue-500 outline-none"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value)}
                        />
                        <button 
                          onClick={() => handleAction('verify_otp')}
                          disabled={loading || otpCode.length < 6}
                          className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          CONFIRMER MA SIGNATURE
                        </button>
                     </div>
                   )}
                 </>
               )}
            </div>

            {error && <p className="mt-4 text-center text-sm font-bold text-red-600">{error}</p>}
            {okMsg && <p className="mt-4 text-center text-sm font-bold text-emerald-600">{okMsg}</p>}
          </section>

        </div>
      </div>
    </div>
  );
}