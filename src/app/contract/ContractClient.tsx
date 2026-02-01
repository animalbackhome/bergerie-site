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
  }, [booking]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6 font-bold">
          <h1 className="text-3xl">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200 italic">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          <h2 className="mb-6 text-2xl font-black text-[#06243D] underline uppercase">3) Prix & Prestations</h2>
          <div className="space-y-3 text-black mb-10">
            <div className="flex justify-between"><span>Hébergement :</span><span className="font-bold">{toMoneyEUR(pricingData.base)}</span></div>
            <div className="flex justify-between"><span>Forfait ménage :</span><span className="font-bold">{toMoneyEUR(pricingData.menage)}</span></div>
            <div className="flex justify-between"><span>Taxe de séjour :</span><span className="font-bold">{toMoneyEUR(pricingData.taxe)}</span></div>
            {pricingData.options.map((opt, i) => (
              <div key={i} className="flex justify-between italic text-slate-700">
                <span className="capitalize">+ {opt.label} :</span>
                <span className="font-bold">{toMoneyEUR(opt.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-2xl font-black pt-4 border-t-2 border-[#06243D]">
              <span>TOTAL :</span><span>{toMoneyEUR(pricingData.total)}</span>
            </div>
          </div>

          <h2 className="mb-4 text-2xl font-black text-[#06243D] underline uppercase">4) Annexes Intégrales</h2>

          <AnnexeBlock title="Annexe 1 — État descriptif complet">
{`🌿 Cadre & localisation
• Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.
• À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).
• À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière.
• Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été.
• Terrain arboré de 3 750 m² : pins, chênes, oliviers, sans vis-à-vis.
• Accès par piste forestière : immersion totale dès les premières minutes.

🏡 Le logement
• Villa spacieuse de 215 m² pensée pour les familles ou amis.
• Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m².
• Grande véranda lumineuse avec grandes tables.
• Salon cosy avec poêle à bois, TV et coin bar.
• Chambre XXL (≈35 m²) avec deux lits doubles, dressing.
• Chambre familiale avec lit double, lit bébé, jeux, livres.
• Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo, baby-foot.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 2 — Inventaire complet des équipements">
{`🛁 Salle de bain : 2 sèche-cheveux, 2 douches à l’italienne, Machine à laver, Produits de nettoyage, Shampooing, Savon, Gel douche, Eau chaude.
🛏️ Chambre et linge : Équipements de base, Grand dressing, Cintres, Draps, Couettes, Couvertures supplémentaires, 4 oreillers par lit, Traversins, Fer à repasser, Moustiquaire.
🎬 Divertissement : Starlink (WiFi haute vitesse), TV (Netflix), Jeux enfants, Terrain de boules, Badminton, Panier de basket, Piscine privée.
👨‍👩‍👧‍👦 Famille : Lit bébé, Lit parapluie, Chaise haute, Pare-feu poêle, Salle de jeux, Aire de jeux extérieure.
🍽️ Cuisine : Réfrigérateur, Four micro-ondes, Mini frigo, Congélateur, Lave-vaisselle, Cuisinière, Four, Bouilloire, Cafetière, Grille-pain, Appareil barbecue électrique.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 3 — Règlement Intérieur (Texte Officiel)" defaultOpen={true}>
{`▶️ Le GPS ne trouvant pas la villa, rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée.
⛔️ Fêtes strictement interdites : expulsion immédiate via la plateforme ou la police.
‼️ Nombre de personnes limité à 8. Supplément de 50 €/personne/nuit pour tout dépassement.
🚻 Personnes non déclarées interdites : toute personne supplémentaire doit être signalée.
🎦 Caméras de surveillance sur l’accès afin d’éviter tout abus.
❌ Les canapés ne sont pas convertibles : il est interdit d’y dormir.
🛏️ Merci de NE PAS enlever la literie des lits avant votre départ.
❌ Ne pas retirer les tapis noir du four pendant les cuissons, ne pas les jeter.
🚭 Non-fumeurs à l’intérieur : cendriers obligatoires en extérieur (risque incendie élevé).
🚮 Poubelles : à emporter à votre départ.
🍽️ Vaisselle : à placer dans le lave-vaisselle avant de partir.
🏊‍♀️ Accès interdit au local technique de la piscine. Ne pas manipuler la pompe ni les vannes.
❌ Ne pas démonter ni ouvrir ni arracher l’alarme de la piscine.
🍗 Barbecue autorisé sauf par vent fort : charbon non fourni. Laisser le barbecue propre.
🐶 Animaux acceptés avec supplément de 10 euros par chien et par nuit.
🕯️ Poêle à bois en option : 40 € (1/4 de stère). À réserver avant l’arrivée.
📍 Arrivée entre 16h et 18h / Départ à 10h maximum.`}
          </AnnexeBlock>

          <div className="mt-12 border-t-4 border-[#06243D] pt-10 text-black">
             <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1 cursor-pointer" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-sm font-bold leading-tight cursor-pointer">
                Je certifie l'exactitude des informations et j'accepte l'intégralité du contrat, du règlement intérieur et des annexes.
              </label>
            </div>
            <div className="flex items-center gap-4 font-bold mb-6">
              <span>Fait à Carcès, le :</span>
              <input type="text" placeholder="JJ/MM/AAAA" className="rounded border border-slate-400 p-2 w-40 text-black bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} />
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