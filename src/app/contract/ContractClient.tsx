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
  adults_count?: number | null;
  children_count?: number | null;
  animals_count?: number | null;
  pricing?: any;
};

type Props = { booking: Booking; token: string; existing: any; };

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
      {isOpen && <div className="p-5 text-sm leading-relaxed text-black bg-white border-t border-slate-200 whitespace-pre-wrap">{children}</div>}
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

  // --- ÉTATS FORMULAIRE ---
  const [addressLine1, setAddressLine1] = useState(existing?.signer_address_line1 || "");
  const [postalCode, setPostalCode] = useState(existing?.signer_postal_code || "");
  const [city, setCity] = useState(existing?.signer_city || "");
  const [contractDate, setContractDate] = useState(existing?.contract_date || "");
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSigned = Boolean(existing?.signed_at);

  // --- CALCUL PRICING DÉTAILLÉ ---
  const pricingData = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    
    // On extrait les options pour le détail
    const excludedKeys = ['total', 'cleaning', 'tourist_tax', 'base_accommodation', 'grand_total'];
    const optionsDetail = Object.entries(p)
      .filter(([key, val]) => !excludedKeys.includes(key) && typeof val === 'number' && val > 0)
      .map(([key, val]) => ({ label: key.replace(/_/g, ' '), value: val as number }));

    return {
      total,
      acompte,
      solde: total - acompte,
      menage: p.cleaning || 100,
      taxe: p.tourist_tax || 0,
      base: p.base_accommodation || 0,
      options: optionsDetail
    };
  }, [booking.pricing]);

  const nights = useMemo(() => {
    const a = new Date(booking.arrival_date).getTime();
    const b = new Date(booking.departure_date).getTime();
    return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
  }, [booking.arrival_date, booking.departure_date]);

  // Initialisation des occupants
  useEffect(() => {
    if (existing?.occupants) {
      setOccupants(existing.occupants);
    } else {
      const total = (booking.adults_count || 0) + (booking.children_count || 0) || 1;
      setOccupants(Array.from({ length: Math.min(8, total) }).map((_, i) => ({
        first_name: i === 0 ? booking.full_name.split(' ')[0] : "",
        last_name: i === 0 ? booking.full_name.split(' ').slice(1).join(' ') : "",
        age: ""
      })));
    }
  }, [booking, existing]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER BLEU */}
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          {/* 1) PARTIES */}
          <section className="mb-10 border-b pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">1) Les Parties</h2>
            <div className="grid gap-8 md:grid-cols-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Propriétaire (Bailleur)</h3>
                <p className="font-bold">{OWNER.name}</p>
                <p>{OWNER.address}</p>
                <p>{OWNER.email} • {OWNER.phone}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
                <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Le Locataire</h3>
                <p className="font-bold mb-3">{booking.full_name}</p>
                <div className="space-y-3">
                  <input placeholder="Adresse complète *" className="w-full rounded border p-2 text-black bg-white" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} disabled={isSigned} />
                  <div className="flex gap-2">
                    <input placeholder="Code Postal *" className="w-1/3 rounded border p-2 text-black bg-white" value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={isSigned} />
                    <input placeholder="Ville *" className="w-2/3 rounded border p-2 text-black bg-white" value={city} onChange={e => setCity(e.target.value)} disabled={isSigned} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3) PRIX DÉTAILLÉ */}
          <section className="mb-10 border-b pb-8 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">3) Prix & Prestations</h2>
            <div className="space-y-2 text-sm font-medium">
              <div className="flex justify-between"><span>Hébergement ({nights} nuits) :</span><span>{toMoneyEUR(pricingData.base)}</span></div>
              <div className="flex justify-between"><span>Forfait ménage :</span><span>{toMoneyEUR(pricingData.menage)}</span></div>
              <div className="flex justify-between"><span>Taxe de séjour :</span><span>{toMoneyEUR(pricingData.taxe)}</span></div>
              
              {/* DÉTAIL DES OPTIONS */}
              {pricingData.options.map((opt, i) => (
                <div key={i} className="flex justify-between text-slate-600 italic">
                  <span className="capitalize">+ {opt.label} :</span>
                  <span>{toMoneyEUR(opt.value)}</span>
                </div>
              ))}

              <div className="flex justify-between text-2xl font-black pt-4 text-[#06243D] border-t">
                <span>TOTAL DU SÉJOUR :</span><span>{toMoneyEUR(pricingData.total)}</span>
              </div>
            </div>
          </section>

          {/* 4) TOUTES LES ANNEXES SANS COUPURE */}
          <section className="mb-10 text-black">
            <h2 className="mb-6 text-2xl font-extrabold text-[#06243D] underline">4) Annexes</h2>

            <AnnexeBlock title="Annexe 1 — État descriptif complet">
{`🌿 Cadre & localisation
• Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.
• À Carcès (Provence), à 10 minutes du village et de ses commerces.
• À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière.
• Terrain arboré de 3 750 m² : pins, chênes, oliviers, sans vis-à-vis.

🏡 Le logement (215 m²)
• Cuisine équipée avec bar ouverte sur terrasse de 40 m².
• Grande véranda lumineuse avec grandes tables.
• Salon cosy avec poêle à bois, TV et coin bar.
• Chambre XXL (≈35 m²) avec deux lits doubles, dressing.
• Chambre familiale avec lit double, lit bébé, espace enfant.
• Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche italienne, petit frigo, baby-foot.

🏝️ Extérieurs & équipements
• Piscine au sel (Diffazur), terrain de badminton, panier de basket, terrain de boules.
• Maison de gardien à env. 50 m pour assistance.`}
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 2 — Inventaire détaillé">
{`🛁 Salle de bain : 2 sèche-cheveux, 2 douches italiennes, Machine à laver.
🛏️ Linge : Serviettes, draps, couettes et couvertures fournis.
🎬 Divertissement : Starlink (Fibre), TV (Netflix), Terrain de boules, Badminton, Basket, Piscine.
👶 Famille : Lit bébé, Lit parapluie, Chaise haute, Pare-feu poêle, Aire de jeux.
🍽️ Cuisine : Réfrigérateur + Mini frigo, Lave-vaisselle, Four, Micro-ondes, Cafetière, Bouilloire, Grille-pain, Appareil barbecue électrique.`}
            </AnnexeBlock>

            <AnnexeBlock title="Annexe 3 — Règlement Intérieur COMPLET" defaultOpen={true}>
{`▶️ RDV obligatoire à La Chapelle Notre Dame (715 Chemin Notre Dame) pour guidage.
⛔ Fêtes strictement interdites : expulsion immédiate via police.
‼️ Limite 8 personnes. Supplément 50 €/nuit/personne non déclarée.
🎦 Caméras de surveillance sur les accès extérieurs uniquement.
❌ Canapés non convertibles : interdit d'y dormir.
🚭 Non-fumeurs à l’intérieur : cendriers obligatoires dehors (risque incendie).
🚮 Poubelles à emporter au départ. Vaisselle propre et lave-vaisselle vidé.
🏊 Accès local technique piscine interdit. Manipulation alarme obligatoire.
🔥 Barbecue autorisé sauf vent fort. Charbon non fourni.
🐶 Animaux : 10 € / nuit / chien à payer à l'arrivée.
📍 Arrivée 16h-18h / Départ 10h max.`}
            </AnnexeBlock>
          </section>

          {/* 5) OCCUPANTS */}
          <section className="mb-10 rounded-xl bg-slate-50 p-6 border border-slate-200 text-black">
            <h2 className="mb-4 text-xl font-bold text-[#06243D]">5) Liste des occupants</h2>
            <div className="space-y-3">
              {occupants.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Prénom" className="w-1/3 rounded border border-slate-300 p-2 text-black bg-white" value={o.first_name} onChange={e => {
                    const n = [...occupants]; n[i].first_name = e.target.value; setOccupants(n);
                  }} disabled={isSigned} />
                  <input placeholder="Nom" className="w-1/3 rounded border border-slate-300 p-2 text-black bg-white" value={o.last_name} onChange={e => {
                    const n = [...occupants]; n[i].last_name = e.target.value; setOccupants(n);
                  }} disabled={isSigned} />
                  <input placeholder="Âge" className="w-1/4 rounded border border-slate-300 p-2 text-black bg-white" value={o.age} onChange={e => {
                    const n = [...occupants]; n[i].age = e.target.value; setOccupants(n);
                  }} disabled={isSigned} />
                </div>
              ))}
            </div>
          </section>

          {/* SIGNATURE & DATE */}
          <div className="mt-12 border-t-4 border-[#06243D] pt-10 text-black">
            <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} disabled={isSigned} />
              <label htmlFor="sign" className="text-sm font-bold leading-tight cursor-pointer">
                Je certifie l'exactitude des informations et j'accepte sans réserve le contrat et le règlement intérieur.
              </label>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 font-bold">
                <span>Fait à Carcès, le :</span>
                <input type="text" placeholder="JJ/MM/AAAA" className="rounded border border-slate-400 p-2 w-40 text-black bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} disabled={isSigned} />
              </div>

              <button 
                disabled={!acceptedTerms || !token || loading}
                className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white shadow-2xl hover:bg-black disabled:opacity-30 uppercase tracking-widest"
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