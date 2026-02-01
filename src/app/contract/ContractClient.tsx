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
  animals_count?: number;
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

function AnnexeBlock({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-left font-bold text-slate-900 hover:bg-slate-200 transition-colors"
      >
        <span>{title}</span>
        <span className="text-xl">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="p-5 text-sm leading-relaxed text-black bg-white border-t border-slate-200">{children}</div>}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    return { 
      total, acompte, solde: total - acompte, 
      menage: p.cleaning || 100, 
      taxe: p.tourist_tax || 0, 
      options: p.options_total || 0,
      base: (total - (p.cleaning || 100) - (p.tourist_tax || 0) - (p.options_total || 0)) 
    };
  }, [booking.pricing]);

  const nights = useMemo(() => {
    const a = new Date(booking.arrival_date).getTime();
    const b = new Date(booking.departure_date).getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }, [booking.arrival_date, booking.departure_date]);

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
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          <section className="mb-10 border-b border-slate-200 pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline uppercase tracking-tight">1) Les Parties</h2>
            <div className="grid gap-8 md:grid-cols-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Propriétaire (Bailleur)</h3>
                <p className="font-bold text-slate-900">{OWNER.name}</p>
                <p className="text-slate-700">{OWNER.address}</p>
                <p className="text-slate-700">{OWNER.email} • {OWNER.phone}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Locataire</h3>
                <p className="font-bold text-slate-900 mb-3">{booking.full_name} ({booking.email})</p>
                <div className="space-y-3">
                  <input placeholder="Adresse complète *" className="w-full rounded-md border-slate-300 p-2 text-black bg-white border" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                  <div className="flex gap-2">
                    <input placeholder="Code Postal *" className="w-1/3 rounded-md border-slate-300 p-2 text-black bg-white border" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                    <input placeholder="Ville *" className="w-2/3 rounded-md border-slate-300 p-2 text-black bg-white border" value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-slate-500 italic">Le locataire déclare être majeur et avoir la capacité de contracter. Les parties font élection de domicile aux adresses indiquées ci-dessus.</p>
          </section>

          <section className="mb-10 border-b border-slate-200 pb-8">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline uppercase tracking-tight">2) Objet & Dates</h2>
            <div className="space-y-4 text-sm text-black">
              <p><strong>Désignation :</strong> Location saisonnière meublée sise au {PROPERTY_ADDRESS}. Capacité maximale de 8 personnes.</p>
              <div className="flex flex-wrap gap-4 font-bold">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">Arrivée : {formatDateFR(booking.arrival_date)} (16h-18h)</div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">Départ : {formatDateFR(booking.departure_date)} (10h max)</div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">{nights} nuits</div>
              </div>
            </div>
          </section>

          <section className="mb-10 border-b border-slate-200 pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline uppercase tracking-tight">3) Prix & Paiement (Virement Uniquement)</h2>
            <div className="space-y-2 font-medium text-sm">
              <div className="flex justify-between"><span>Hébergement :</span><span>{toMoneyEUR(pricing.base)}</span></div>
              <div className="flex justify-between"><span>Forfait ménage (obligatoire) :</span><span>{toMoneyEUR(pricing.menage)}</span></div>
              <div className="flex justify-between"><span>Taxe de séjour :</span><span>{toMoneyEUR(pricing.taxe)}</span></div>
              {pricing.options > 0 && <div className="flex justify-between"><span>Options :</span><span>{toMoneyEUR(pricing.options)}</span></div>}
              <div className="flex justify-between text-2xl font-black pt-4 text-[#06243D] border-t">
                <span>TOTAL DU SÉJOUR :</span><span>{toMoneyEUR(pricing.total)}</span>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900 space-y-3">
              <p><strong>5.1 Acompte (30%) :</strong> Un montant de <strong>{toMoneyEUR(pricing.acompte)}</strong> est dû immédiatement à la signature. Cette somme constitue un acompte et non des arrhes.</p>
              <p><strong>5.2 Solde (70%) :</strong> Le montant de <strong>{toMoneyEUR(pricing.solde)}</strong> doit être réglé au plus tard 7 jours avant l'entrée dans les lieux.</p>
              <p className="text-xs italic">Aucun paiement par chèque n'est accepté. Le dépôt de garantie de 500€ sera demandé en espèces à l'arrivée.</p>
            </div>
          </section>

          <section className="mb-10 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline uppercase tracking-tight">4) Annexes du contrat</h2>
            
            <AnnexeBlock title="Annexe 1 — État descriptif du logement">
              <div className="space-y-4 whitespace-pre-wrap">
                <strong>🌿 Cadre & Localisation :</strong> Bergerie en pierres nichée en pleine forêt à Carcès, terrain arboré de 3 750 m², sans vis-à-vis. Proche lac, cascades et rivière. Accès par piste forestière.
                {"\n"}<strong>🏡 Le Logement (215 m²) :</strong> Cuisine équipée, terrasse 40 m², grande véranda, salon avec poêle à bois. Chambre XXL (35m²), Chambre familiale avec lit bébé.
                {"\n"}<strong>🛌 Suite indépendante :</strong> Accès direct piscine, lit king-size, douche italienne, petit frigo, baby-foot.
                {"\n"}<strong>🏝️ Extérieurs :</strong> Piscine au sel, badminton, basket, terrain de boules, aire de jeux enfants.
              </div>
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 2 — Inventaire complet des équipements">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div>
                  <h4 className="font-bold underline mb-2">Cuisine & Salle à manger</h4>
                  <p>Réfrigérateurs, Congélateur, Lave-vaisselle, Four, Micro-ondes, Bouilloire, Cafetières, Grille-pain, Appareil à raclette, Vaisselle complète pour 8+ pers.</p>
                </div>
                <div>
                  <h4 className="font-bold underline mb-2">Chambres & Linge</h4>
                  <p>Literie complète, Draps et serviettes de douche fournis, 4 oreillers/lit, Couvertures sup, Dressing, Fer à repasser, Sèche-cheveux (2).</p>
                </div>
                <div>
                  <h4 className="font-bold underline mb-2">Loisirs & Divertissement</h4>
                  <p>Starlink (WiFi haute vitesse), TV (Netflix), Baby-foot, Jeux de société, Livres, Terrain de pétanque, Basket, Badminton, Piscine.</p>
                </div>
                <div>
                  <h4 className="font-bold underline mb-2">Sécurité & Divers</h4>
                  <p>Alarme piscine, Détecteurs fumée/CO, Extincteur, Trousse secours, Machine à laver, Lit bébé, Chaise haute.</p>
                </div>
              </div>
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 3 — Règlement Intérieur" defaultOpen={true}>
              <div className="space-y-3 text-xs leading-relaxed">
                <p>📍 <strong>Rendez-vous :</strong> RDV à la Chapelle Notre Dame pour guidage (GPS imprécis en forêt). Merci de prévenir 30 min avant.</p>
                <p>⛔ <strong>Fêtes & Bruit :</strong> Fêtes strictement interdites. Expulsion immédiate en cas de non-respect.</p>
                <p>‼️ <strong>Capacité :</strong> Max 8 personnes. Personnes non déclarées interdites. Supplément 50€/pers/nuit si dépassement.</p>
                <p>🚭 <strong>Tabac :</strong> Non-fumeur à l'intérieur. Cendriers obligatoires en extérieur (risque incendie forêt).</p>
                <p>🐶 <strong>Animaux :</strong> Supplément 10€/chien/nuit. Ramassage des déjections obligatoire.</p>
                <p>🧹 <strong>Entretien :</strong> Poubelles à évacuer au départ. Vaisselle faite et lave-vaisselle vidé. Barbecue rendu propre.</p>
                <p>🏊 <strong>Piscine :</strong> Alarme obligatoire. Manipulation vannes local technique interdite.</p>
                <p>📍 <strong>Check-in/out :</strong> Arrivée 16h-18h / Départ 10h max.</p>
              </div>
            </AnnexeBlock>
          </section>

          <section className="mb-10 rounded-xl bg-slate-50 p-6 border border-slate-200 text-black">
            <h2 className="mb-4 text-xl font-bold text-[#06243D]">5) Liste des occupants (Nom, Prénom, Âge)</h2>
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
            <p className="mt-4 text-[10px] text-slate-500 italic">Conformément au RGPD, ces données sont collectées uniquement pour la gestion de votre séjour et ne seront jamais transmises à des tiers. Vous devez présenter une pièce d'identité à l'arrivée.</p>
          </section>

          <div className="mt-12 border-t-4 border-[#06243D] pt-10 text-black">
            <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1 cursor-pointer" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-sm font-bold leading-tight cursor-pointer">
                Je déclare avoir pris connaissance de l'intégralité du contrat et de ses annexes (État descriptif, Inventaire, Règlement intérieur), j'en accepte sans réserve les conditions et je certifie l'exactitude des informations fournies ci-dessus.
              </label>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 font-bold">
                <span>Fait à Carcès, le :</span>
                <input type="text" placeholder="JJ/MM/AAAA" className="rounded border border-slate-400 p-2 w-40 text-black bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} />
              </div>

              <button 
                disabled={!acceptedTerms || !token}
                className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white shadow-2xl hover:bg-black transition-all transform hover:scale-[1.01] disabled:opacity-30 uppercase tracking-widest"
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