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
    <div className="min-h-screen bg-slate-50 pb-20 text-black font-sans">
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold uppercase italic">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200 italic">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          <div className="space-y-12 whitespace-pre-wrap text-sm leading-relaxed">
            {/* ARTICLES 1 À 20 */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">1) Parties</h2>
              <p><strong>Propriétaire (Bailleur)</strong></p>
              <p>Nom / Prénom : {OWNER.name}</p>
              <p>Adresse : {OWNER.address}</p>
              <p>E-mail : {OWNER.email}</p>
              <p>Téléphone : {OWNER.phone}</p>
              <p className="mt-4"><strong>Locataire</strong></p>
              <p>Nom / Prénom : {booking.full_name}</p>
              <div className="mt-2 space-y-2">
                <input placeholder="Adresse complète *" className="w-full border p-2 rounded bg-white" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                <div className="flex gap-2">
                  <input placeholder="CP *" className="w-1/3 border p-2 rounded bg-white" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                  <input placeholder="Ville *" className="w-2/3 border p-2 rounded bg-white" value={city} onChange={e => setCity(e.target.value)} />
                </div>
              </div>
              <p className="mt-2">E-mail : {booking.email}</p>
              <p>Téléphone : {booking.phone || "[]"}</p>
              <p className="mt-4 italic">Le locataire déclare être majeur et avoir la capacité de contracter. Conformément au RGPD, ces données sont traitées uniquement pour l'exécution de ce contrat.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">2) Logement loué</h2>
              <p>Désignation : Location saisonnière meublée</p>
              <p>Adresse du logement : {PROPERTY_ADDRESS}</p>
              <p>Capacité maximale : 8 personnes (voir Article 11).</p>
              <p>Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.</p>
              <p className="mt-4"><strong>Annexes (faisant partie intégrante du contrat) :</strong></p>
              <p>Annexe 1 : État descriptif du logement (repris du site)</p>
              <p>Annexe 2 : Inventaire / liste équipements (repris du site)</p>
              <p>Annexe 3 : Règlement intérieur (repris et signé)</p>
              <p>Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">3) Durée — Dates — Horaires</h2>
              <p>Période : du {formatDateFR(booking.arrival_date)} au {formatDateFR(booking.departure_date)} pour {nights} nuits.</p>
              <p className="mt-2"><strong>Horaires standard :</strong></p>
              <p>Arrivée (check-in) : entre 16h et 18h</p>
              <p>Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)</p>
              <p className="mt-2"><strong>Options (si accord préalable et selon disponibilités) :</strong></p>
              <p>Arrivée début de journée : +70€</p>
              <p>Départ fin de journée : +70€</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">4) Prix — Taxes — Prestations</h2>
              <p><strong>Prix total du séjour : {toMoneyEUR(pricingData.total)}</strong> comprenant :</p>
              <p>Hébergement : {toMoneyEUR(pricingData.base)}</p>
              <p>Forfait ménage : {toMoneyEUR(pricingData.menage)}</p>
              <p>Taxe de séjour : {toMoneyEUR(pricingData.taxe)} (si applicable / selon règles locales)</p>
              {pricingData.options.map((opt, i) => (
                <p key={i} className="capitalize">+ {opt.label} : {toMoneyEUR(opt.value)}</p>
              ))}
            </section>

            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)</h2>
              <p>Mode de paiement : virement bancaire uniquement. Aucun paiement par chèque n’est accepté.</p>
              <p><strong>5.1 Acompte (30%) :</strong> Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit {toMoneyEUR(pricingData.acompte)}.</p>
              <p>✅ Les parties conviennent expressément que la somme versée à la réservation constitue un ACOMPTE et non des arrhes.</p>
              <p><strong>5.2 Solde :</strong> Le solde, soit {toMoneyEUR(pricingData.solde)}, doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.</p>
              <p>À défaut de paiement du solde dans ce délai, et sans réponse dans les 48h suivant l’e-mail de relance, le propriétaire pourra considérer la réservation comme annulée par le locataire, l’acompte restant acquis au propriétaire.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase text-black">Articles Complémentaires (6 à 20)</h2>
              <p><strong>6) Formation du contrat :</strong> La réservation devient effective dès réception du présent contrat signé et de l’acompte.</p>
              <p><strong>7) Absence de droit de rétractation :</strong> Prestation fournie à une date déterminée, pas de droit de rétractation.</p>
              <p><strong>8) Annulation :</strong> Acompte de 30% acquis. À compter du paiement du solde (J-7), aucun remboursement possible.</p>
              <p><strong>12) Dépôt de garantie :</strong> 500€ en liquide à l’arrivée. Restitué après état des lieux, déduction faite des dommages éventuels.</p>
              <p><strong>16) Caméras :</strong> Informé de caméras sur les accès extérieurs uniquement pour sécurité.</p>
              <p><strong>17) Assurance :</strong> Locataire responsable des dommages, assurance villégiature recommandée.</p>
            </section>
          </div>

          <h2 className="mt-12 text-2xl font-black text-[#06243D] underline uppercase">Annexes (Textes Intégraux)</h2>

          <AnnexeBlock title="Annexe 1 : État descriptif du logement">
{`Bergerie provençale en pleine nature, grand confort, piscine au sel, accès rapide lac/cascades, et espaces pensés pour les familles comme pour les séjours entre amis. 🌿

🌿 Cadre & localisation
🌿 Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.
📍 À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).
🏞️ À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière, idéal pour les amoureux de plein air.
💧 Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été et paysages superbes.
🌳 Terrain arboré de 3 750 m² : pins, chênes, oliviers et essences provençales, sans vis-à-vis.
✨ Nuits incroyables : ciel étoilé, silence, ambiance “seul au monde” au cœur de la nature.
🦌 Rencontres possibles : biches, chevreuils, renards.
🚗 Accès par piste forestière : arrivée dépaysante, immersion totale.

🏡 Le logement
👨‍👩‍👧‍👦 Villa spacieuse et conviviale (215 m²) pour partager des moments en famille ou entre amis.
🍽️ Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m².
🌤️ Grande véranda lumineuse avec grandes tables.
🔥 Salon cosy avec poêle à bois, TV et coin bar.
🛏️ Chambre XXL (≈35 m²) avec deux lits doubles, dressing.
🧸 Chambre familiale avec lit double, lit bébé, jeux, livres.
🚿 Salle de bains avec grande douche à l’italienne, double vasque, serviettes fournies.
🚻 WC séparé avec lave-mains.

🛌 Suite indépendante
🛌 Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo.
⚽ Baby-foot à disposition dans la suite.

🏝️ Extérieurs & équipements
🌀 Piscine au sel (Diffazur) : transats, bouées et jeux.
🎾 Terrain de badminton.
🏀 Panier de basket.
🎯 Terrain de boules pour l’esprit “vacances en Provence”.
🛝 Jeux pour enfants.
🌴 Espace repas ombragé sous un grand arbre.
🚗 Grand parking gratuit + abri voiture sur la propriété.
🥾 Départ de balades direct : forêt, lac, cascades.

🌟 Petite touche unique
🧑‍🌾 Maison de gardien à env. 50 m : présence rassurante et aide possible.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 2 : Inventaire / Liste équipements">
{`🛁 Salle de bain : 2 sèche-cheveux, 2 douches à l’italienne, Machine à laver, Produits de nettoyage, Shampooing, Savon pour le corps, Gel douche, Eau chaude.

🛏️ Chambre et linge : Équipements de base, Serviettes, draps, savon et papier toilette, Grand dressing, Cintres, Draps, Couettes, Couvertures supplémentaires, 4 oreillers par lit, Traversins, Tables de nuit, Lampes de chevet, Stores, Fer à repasser, Étendoir à linge, Moustiquaire.

🎬 Divertissement : Connexion maxi vitesse Starlink, Télévision (chaînes + Netflix + jeux vidéos), Livres, Jeux enfants, Terrain de boules, Jeux aquatiques, Badminton, Basket, Piscine.

👨‍👩‍👧‍👦 Famille : Lit bébé (1,3 m x 70 cm), Lit parapluie, Livres & jouets, Chaise haute, Pare-feu poêle, Salle de jeux, Aire de jeux extérieure, Alarme piscine.

🔥 Chauffage/Climatisation : Poêle à bois (en option), Ventilateurs portables, Chauffage central.

🧯 Sécurité : Détecteur de fumée, Monoxyde de carbone, Extincteur, Kit premiers secours, Bâches anti-feu.

🍽️ Cuisine : Cuisine équipée, Réfrigérateur, Micro-ondes, Mini frigo, Congélateur, Lave-vaisselle, Cuisinière, Four, Bouilloire, Cafetière, Vaisselle & couverts, Ustensiles barbecue.

📍 Emplacement : Accès lac/cascades à pied, Entrée privée piste en terre, Laverie à proximité.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 3 : Règlement Intérieur (Texte Officiel)" defaultOpen={true}>
{`▶️ Le GPS ne trouvant pas la villa en pleine forêt, nous vous donnons rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée.

▶️ Suite à de nombreuses mauvaises expériences, un état des lieux sera effectué à l’arrivée et au départ.

⛔️ Fêtes strictement interdites : expulsion immédiate.
‼️ Nombre de personnes limité à 8. Supplément 50 €/pers/nuit pour tout dépassement (journée ou nuit).
🚻 Personnes non déclarées interdites.
🎦 Caméras de surveillance sur l’accès extérieur.
🚼 Apporter matelas et literie pour personnes sup.
❌ Canapés non convertibles : interdit d’y dormir.
🛏️ NE PAS enlever la literie avant le départ.
❌ Ne pas retirer les tapis noir du four, ne pas les jeter.
🚭 Non-fumeurs à l’intérieur : cendriers obligatoires dehors.
🚮 Poubelles : à emporter à votre départ.
🍽️ Vaisselle : au lave-vaisselle (ne pas laisser dans l’évier).
✅ Linge fourni : serviettes douche (hors piscine), draps.
📛 Zones privées interdites (enclos des chats).
🏊‍♀️ Local technique piscine interdit. Manipulation pompe/vannes interdite.
❌ Ne pas démonter l’alarme piscine.
🔥 Sécurité incendie : pétards et feux d'artifice interdits.
🍗 Barbecue propre après usage. Cendres froides dans un sac.
🐶 Animaux : supplément 10 €/chien/nuit.
✅ Produits fournis : savon, papier toilette, sel, poivre, sucre, etc.
🚰 Prévoir packs d’eau (eau du forage).
🕯️ Poêle à bois en option : 40 € (1/4 de stère).
📍 Arrivée 16h-18h / Départ 10h maximum.`}
          </AnnexeBlock>

          <div className="mt-12 border-t-4 border-[#06243D] pt-10 text-black">
            <div className="flex items-start gap-3 mb-8">
              <input type="checkbox" id="sign" className="h-6 w-6 mt-1 cursor-pointer" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-sm font-bold leading-tight cursor-pointer">
                Je déclare avoir pris connaissance de l'intégralité du contrat et de ses annexes (État descriptif, Inventaire, Règlement intérieur), j'en accepte sans réserve les conditions et je certifie l'exactitude des informations fournies.
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