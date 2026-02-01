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
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm text-black">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-left font-bold text-slate-900 hover:bg-slate-200"
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

  const pricingData = useMemo(() => {
    const p = booking.pricing || {};
    const total = p.total || 0;
    const acompte = Math.round(total * 0.3);
    const excluded = ['total', 'cleaning', 'tourist_tax', 'base_accommodation', 'grand_total'];
    const options = Object.entries(p)
      .filter(([k, v]) => !excluded.includes(k) && typeof v === 'number' && v > 0)
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
    }
  }, [booking, existing]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-black">
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold uppercase italic">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          <h2 className="mb-6 text-2xl font-black text-[#06243D] underline uppercase">1) Parties</h2>
          <div className="grid gap-8 md:grid-cols-2 text-sm mb-10">
            <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
              <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Propriétaire (Bailleur)</h3>
              <p className="font-bold">{OWNER.name}</p>
              <p>{OWNER.address}</p>
              <p>{OWNER.email} • {OWNER.phone}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 border border-slate-200">
              <h3 className="font-black text-blue-900 uppercase text-xs mb-2">Locataire</h3>
              <p className="font-bold mb-2">{booking.full_name}</p>
              <div className="space-y-3">
                <input placeholder="Adresse complète *" className="w-full rounded border p-2 bg-white" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                <div className="flex gap-2">
                  <input placeholder="CP *" className="w-1/3 rounded border p-2 bg-white" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                  <input placeholder="Ville *" className="w-2/3 rounded border p-2 bg-white" value={city} onChange={e => setCity(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <h2 className="mb-6 text-2xl font-black text-[#06243D] underline uppercase">3) Prix & Prestations</h2>
          <div className="space-y-2 mb-10 font-medium">
            <div className="flex justify-between"><span>Hébergement ({nights} nuits) :</span><span>{toMoneyEUR(pricingData.base)}</span></div>
            <div className="flex justify-between"><span>Forfait ménage :</span><span>{toMoneyEUR(pricingData.menage)}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Taxe de séjour :</span><span>{toMoneyEUR(pricingData.taxe)}</span></div>
            {pricingData.options.map((opt, i) => (
              <div key={i} className="flex justify-between italic text-slate-700">
                <span className="capitalize">+ {opt.label} :</span>
                <span>{toMoneyEUR(opt.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-2xl font-black pt-4 text-[#06243D]">
              <span>TOTAL DU SÉJOUR :</span><span>{toMoneyEUR(pricingData.total)}</span>
            </div>
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-xs leading-relaxed">
              <strong>Conditions :</strong> Un acompte de 30% ({toMoneyEUR(pricingData.acompte)}) est dû à la signature. Le solde de 70% ({toMoneyEUR(pricingData.solde)}) est dû 7 jours avant l'arrivée.
            </div>
          </div>

          <h2 className="mb-6 text-2xl font-black text-[#06243D] underline uppercase">4) Annexes Intégrales</h2>

          <AnnexeBlock title="Annexe 1 — État descriptif du logement">
{`🌿 Cadre & localisation
• Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.
• À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).
• À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière, idéal pour les amoureux de plein air.
• Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été et paysages superbes.
• Terrain arboré de 3 750 m² : pins, chênes, oliviers et essences provençales, sans vis-à-vis.
• Accès par piste forestière : arrivée dépaysante, immersion totale dès les premières minutes.

🏡 Le logement
• Une villa spacieuse et conviviale (215 m²) pensée pour partager des moments en famille ou entre amis.
• Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m², côté piscine et forêt.
• Grande véranda lumineuse avec grandes tables, parfaite pour les repas “dedans-dehors”.
• Salon cosy avec poêle à bois, TV et coin bar (ambiance chaleureuse le soir).
• Chambre XXL (≈35 m²) avec deux lits doubles, dressing, décoration apaisante.
• Chambre familiale avec lit double, lit bébé, jeux, livres, espace enfant (pratique et rassurant).
• Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo, baby-foot.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 2 — Inventaire complet des équipements">
{`🛁 Salle de bain : 2 sèche-cheveux, 2 douches à l’italienne, Machine à laver, Produits de nettoyage, Shampooing, Savon, Gel douche, Eau chaude.
🛏️ Chambre et linge : Équipements de base, Grand dressing, Cintres, Draps, Couettes, Couvertures supplémentaires, 4 oreillers par lit, Traversins, Fer à repasser, Étendoir, Moustiquaire.
🎬 Divertissement : Starlink (Internet haut débit), Télévision (Netflix), Livres, Jeux enfants, Terrain de boules, Terrain de badminton, Panier de basket, Piscine privée.
👨‍👩‍👧‍👦 Famille : Lit bébé, Lit parapluie, Chaise haute, Pare-feu poêle, Salle de jeux, Aire de jeux extérieure.
🍽️ Cuisine : Réfrigérateur, Micro-ondes, Mini frigo, Congélateur, Lave-vaisselle, Cuisinière, Four, Bouilloire, Cafetière, Grille-pain, Barbecue électrique.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 3 — Règlement Intérieur (Texte Officiel)" defaultOpen={true}>
{`▶️ Le GPS ne trouvant pas la villa en pleine forêt, nous vous donnons rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée afin qu’une personne vienne vous chercher et vous guide jusqu’à la propriété.
⛔️ Fêtes strictement interdites : tout non-respect entraînera une expulsion immédiate via la plateforme ou la police.
‼️ Nombre de personnes limité à 8. Pour toute personne supplémentaire, un supplément de 50 €/personne/nuit sera demandé à l’arrivée ainsi que 50 €/personne supplémentaire en journée (même si elle ne dort pas sur place).
🚻 Personnes non déclarées interdites : toute personne supplémentaire doit être signalée avant la location.
🎦 Caméras de surveillance sur l’accès afin d’éviter tout abus.
❌ Les canapés ne sont pas convertibles : il est interdit d’y dormir.
🛏️ Merci de NE PAS enlever la literie des lits avant votre départ. Toute disparition sera facturée.
❌ Ne pas retirer les tapis noir du four pendant les cuissons, ne pas les jeter.
🚭 Non-fumeurs à l’intérieur : merci d’utiliser un cendrier en extérieur et de ne jeter aucun mégot au sol (risque d’incendie élevé).
🚮 Poubelles : à emporter à votre départ.
🍽️ Vaisselle : à placer dans le lave-vaisselle avant de partir.
🏊‍♀️ Accès interdit au local technique de la piscine. Ne pas manipuler la pompe ni les vannes.
❌ Ne pas démonter ni ouvrir ni arracher l’alarme de la piscine.
🍗 Barbecue autorisé sauf par vent fort : charbon non fourni. Merci de laisser le barbecue propre.
🐶 Animaux acceptés avec supplément de 10 euros par chien et par nuit à payer à votre arrivée.
🕯️ Poêle à bois en option : 40 € (1/4 de stère). À réserver avant l’arrivée.
📍 Arrivée entre 16h et 18h / Départ à 10h maximum.`}
          </AnnexeBlock>

          <div className="mt-12 border-t-4 border-[#06243D] pt-10">
            <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1 cursor-pointer" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-sm font-bold leading-tight cursor-pointer">
                Je certifie l'exactitude des informations et j'accepte l'intégralité du contrat, du règlement intérieur et des annexes.
              </label>
            </div>
            <div className="flex items-center gap-4 font-bold mb-6">
              <span>Fait à Carcès, le :</span>
              <input type="text" placeholder="JJ/MM/AAAA" className="rounded border border-slate-400 p-2 w-40 bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} />
            </div>
            <button disabled={!acceptedTerms || !token} className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white uppercase tracking-widest hover:bg-black disabled:opacity-30">
              Signer le contrat
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}