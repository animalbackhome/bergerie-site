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
      .filter(([k, v]) => !['total', 'cleaning', 'tourist_tax', 'base_accommodation', 'grand_total'].includes(k) && typeof v === 'number' && v > 0)
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
          
          <div className="space-y-10 whitespace-pre-wrap text-sm leading-relaxed">
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

            {/* TEXTE JURIDIQUE COMPLET */}
            <section className="space-y-6">
              <h2 className="text-xl font-black text-[#06243D] underline uppercase">2) Logement loué</h2>
              <p>Désignation : Location saisonnière meublée sise au {PROPERTY_ADDRESS}. Capacité maximale : 8 personnes (voir Article 11). Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.</p>
              <p><strong>Annexes (faisant partie intégrante du contrat) :</strong>
Annexe 1 : État descriptif du logement (repris du site)
Annexe 2 : Inventaire / liste équipements (repris du site)
Annexe 3 : Règlement intérieur (repris et signé)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)</p>

              <h2 className="text-xl font-black text-[#06243D] underline uppercase pt-4">3) Durée — Dates — Horaires</h2>
              <p>Période : du {formatDateFR(booking.arrival_date)} au {formatDateFR(booking.departure_date)} pour {nights} nuits.</p>
              <p><strong>Horaires standard :</strong> Arrivée (check-in) : entre 16h et 18h. Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages).</p>
              <p><strong>Options (si accord préalable et selon disponibilités) :</strong> Arrivée début de journée : +70€ / Départ fin de journée : +70€</p>

              <h2 className="text-xl font-black text-[#06243D] underline uppercase pt-4">4) Prix — Taxes — Prestations</h2>
              <div className="bg-slate-50 p-4 rounded-lg font-medium border">
                <p>Hébergement : {toMoneyEUR(pricingData.base)}</p>
                <p>Forfait ménage : {toMoneyEUR(pricingData.menage)}</p>
                <p>Taxe de séjour : {toMoneyEUR(pricingData.taxe)} (si applicable / selon règles locales)</p>
                {pricingData.options.map((opt, i) => (
                  <p key={i} className="capitalize text-slate-700">+ {opt.label} : {toMoneyEUR(opt.value)}</p>
                ))}
                <p className="text-xl font-black mt-2 pt-2 border-t border-slate-300">TOTAL DU SÉJOUR : {toMoneyEUR(pricingData.total)}</p>
              </div>

              <h2 className="text-lg font-bold text-[#06243D] uppercase">5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)</h2>
              <p>Mode de paiement : virement bancaire uniquement. Aucun paiement par chèque n’est accepté.</p>
              <p><strong>5.1 Acompte (30%) :</strong> Pour bloquer les dates, le locataire verse un acompte de 30% soit {toMoneyEUR(pricingData.acompte)}. Les parties conviennent que la somme constitue un ACOMPTE et non des arrhes.</p>
              <p><strong>5.2 Solde :</strong> Le solde, soit {toMoneyEUR(pricingData.solde)}, doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.</p>
              
              <h2 className="text-lg font-bold text-[#06243D] uppercase">8) Annulation / Non-présentation</h2>
              <p>8.1 Par le locataire : L’acompte de 30% reste acquis. À compter du paiement du solde (J-7), aucun remboursement n’est effectué. 8.2 Non-présentation : À partir de minuit le jour d'arrivée, l'entrée n'est plus possible.</p>

              <h2 className="text-lg font-bold text-[#06243D] uppercase">12) Dépôt de garantie (caution)</h2>
              <p>Un dépôt de garantie de 500€ est demandé en liquide à l’arrivée. Il est restitué après l’état des lieux de sortie, déduction faite des sommes dues au titre des dégradations ou non-respect du règlement.</p>

              <h2 className="text-lg font-bold text-[#06243D] uppercase">16) Caméras (information)</h2>
              <p>Le locataire est informé de la présence de caméras uniquement sur les accès extérieurs à des fins de sécurité. Aucune caméra n’est présente à l’intérieur.</p>
            </section>
          </div>

          {/* ANNEXES INTÉGRALES SANS AUCUN RÉSUMÉ */}
          <AnnexeBlock title="Annexe 1 : État descriptif complet" defaultOpen={false}>
{`Bergerie provençale en pleine nature, grand confort, piscine au sel, accès rapide lac/cascades, et espaces pensés pour les familles comme pour les séjours entre amis. 🌿

🌿 Cadre & localisation
🌿 Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.
📍 À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).
🏞️ À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière, idéal pour les amoureux de plein air.
💧 Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été et paysages superbes.
🌳 Terrain arboré de 3 750 m² : pins, chênes, oliviers et essences provençales, sans vis-à-vis.
✨ Nuits incroyables : ciel étoilé, silence, ambiance “seul au monde” au cœur de la nature.
🦌 Rencontres possibles : biches, chevreuils, renards (la forêt méditerranéenne est tout autour).
🚗 Accès par piste forestière : arrivée dépaysante, immersion totale dès les premières minutes.

🏡 Le logement
👨‍👩‍👧‍👦 Une villa spacieuse et conviviale (215 m²) pensée pour partager des moments en famille ou entre amis.
🍽️ Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m², côté piscine et forêt.
🌤️ Grande véranda lumineuse avec grandes tables, parfaite pour les repas “dedans-dehors”.
🔥 Salon cosy avec poêle à bois, TV et coin bar (ambiance chaleureuse le soir).
🛏️ Chambre XXL (≈35 m²) avec deux lits doubles, dressing, décoration apaisante.
🧸 Chambre familiale avec lit double, lit bébé, jeux, livres, espace enfant (pratique et rassurant).
🚿 Salle de bains avec grande douche à l’italienne, double vasque, rangements, serviettes fournies.
🚻 WC séparé avec lave-mains pour plus de confort.

🛌 Suite indépendante
🛌 Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo.
⚽ Baby-foot à disposition dans la suite (bonus très apprécié).

🏝️ Extérieurs & équipements
🌀 Piscine au sel (Diffazur) : transats, bouées et jeux, pour des journées 100% détente.
🎾 Terrain de badminton.
🏀 Panier de basket.
🎯 Terrain de boules pour l’esprit “vacances en Provence”.
🛝 Jeux pour enfants.
🌴 Espace repas ombragé sous un grand arbre, idéal pour les déjeuners d’été.
🚗 Grand parking gratuit + abri voiture sur la propriété.
🥾 Départ de balades direct : forêt, lac, cascades, randonnées accessibles rapidement.

🌟 Petite touche unique
🧑‍🌾 Maison de gardien à env. 50 m : présence rassurante et aide possible en cas de besoin.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 2 : Inventaire / Liste équipements" defaultOpen={false}>
{`Ce que propose ce logement
Les équipements listés ci-dessous sont disponibles sur place (selon l’organisation du logement).

🛁 Salle de bain
💨 2 sèche-cheveux, 🚿 2 douches à l’italienne, 🧺 Machine à laver, 🧼 Produits de nettoyage, 🧴 Shampooing, 🫧 Savon pour le corps, 🫧 Gel douche, 🔥 Eau chaude.

🛏️ Chambre et linge
✅ Équipements de base (Serviettes, draps, savon et papier toilette), 🧳 Grand dressing, 🧥 Cintres, 🧻 Draps, 🛌 Couettes, 🛌 Couvertures supplémentaires, 🛏️ 4 oreillers par lit, 🛏️ Traversins, 🛋️ Tables de nuit, 💡 Lampes de chevet, 🪟 Stores, 🧲 Fer à repasser, 🧵 Étendoir à linge, 🦟 Moustiquaire.

🎬 Divertissement
🛰️ Connexion Starlink, 📺 Télévision (chaînes + Netflix + jeux vidéos), 📚 Livres, 🧩 Jeux enfants, 🎯 Terrain de boules, 💦 Jeux aquatiques, 🏸 Badminton, 🏀 Panier de basket, 🏊 Piscine, 🥾 Randonnées, 🃏 Jeux pour adultes.

👨‍👩‍👧‍👦 Famille
👶 Lit pour bébé (Standard 1,3 m x 70 cm), 🧸 Lit parapluie, 🧩 Livres & jouets, 🪑 Chaise haute, 🛡️ Pare-feu poêle, 🧸 Salle de jeux, 🛝 Aire de jeux extérieure, 🚨 Alarme piscine, 💦 Jeux aquatiques, 🐟 Petit bassin.

🔥 Chauffage et climatisation
🔥 Poêle à bois (en option), 🌀 Ventilateurs portables, 🌡️ Chauffage central.

🧯 Sécurité
🚨 Détecteur de fumée, ⚠️ Détecteur de CO, 🧯 Extincteur, 🩹 Kit premiers secours, 🧯 Bâches anti-feu.

🍽️ Cuisine et salle à manger
🍳 Cuisine équipée, 🧊 Réfrigérateur, 📡 Micro-ondes, 🧊 Mini frigo (Chambre VIP), ❄️ Congélateur, 🧼 Lave-vaisselle, 🔥 Cuisinière, ♨️ Four, 🫖 Bouilloire, ☕ Cafetière, ☕ Café, 🍷 Verres à vin, 🍞 Grille-pain, 🍳 Plaque de cuisson, 🧂 Équipements de base (huile, sel, poivre), 🍽️ Vaisselle & couverts, 🍖 Ustensiles barbecue, 🪑 Table à manger.

📍 Emplacement
🌊 Accès lac/cascades à pied, 🚪 Entrée privée piste en terre, 🧺 Laverie à proximité.

🌿 Extérieur
🌤️ Patio/balcon, 🌱 Arrière-cour, 🪑 Mobilier extérieur, 🍽️ Espace repas plein air, 🔥 Barbecue électrique, 🧘 Chaises longues.

🚗 Parking et installations
🅿️ Parking gratuit, 🏊 Piscine privée.

🧾 Services
🐾 Animaux acceptés (supplément), 🚭 Non fumeur, 📅 Séjours longue durée, 🔑 Clés remises par l'hôte.`}
          </AnnexeBlock>

          <AnnexeBlock title="Annexe 3 : Règlement Intérieur (Texte Officiel)" defaultOpen={true}>
{`▶️ Le GPS ne trouvant pas la villa en pleine forêt, nous vous donnons rendez-vous à La Chapelle Notre Dame – 715 Chemin Notre Dame, 83570 Carcès. Merci de nous envoyer un message 30 minutes avant votre arrivée afin qu’une personne vienne vous chercher et vous guide jusqu’à la propriété.
▶️ Suite à de nombreuses mauvaises expériences, abus, vols et dégradations, nous sommes dans l'obligation de demander la validation de ce règlement avant toute location. Un état des lieux avec signature sera effectué à l’arrivée et au départ afin de prévenir toute disparition ou détérioration :
⛔️ Fêtes strictement interdites : tout non-respect entraînera une expulsion immédiate via la plateforme ou la police
‼️ Nombre de personnes limité à 8. Pour toute personne supplémentaire, un supplément de 50 €/personne/nuit sera demandé à l’arrivée ainsi que 50 €/personne supplémentaire en journée (même si elle ne dort pas sur place)
🚻 Personnes non déclarées interdites : toute personne supplémentaire doit être signalée avant la location
🎦 Caméras de surveillance sur l’accès afin d’éviter tout abus
🚼 Les personnes supplémentaires doivent apporter leur propre matelas gonflable et literie.
❌ Les canapés ne sont pas convertibles : il est interdit d’y dormir
🛏️ Merci de NE PAS enlever la literie des lits avant votre départ. Toute disparition sera facturée en raison des nombreux vols constatés
❌ Ne pas retirer les tapis noir du four pendant les cuissons, ne pas les jeter.
🚭 Non-fumeurs à l’intérieur : merci d’utiliser un cendrier en extérieur et de ne jeter aucun mégot au sol (risque d’incendie élevé et non-respect du lieu naturel)
🚮 Poubelles : à emporter à votre départ
🍽️ Vaisselle : à placer dans le lave-vaisselle avant de partir (ne pas laisser dans l’évier)
✅ Linge fourni : literies, couvertures supplémentaires et serviettes de douche (grandes et petites). Literie bébé non fournis. Serviettes de piscine non fournies
📛 Zones privées interdites : toute zone non visitée avec la propriétaire est strictement interdite d’accès dont l’enclos des chats.
🏊‍♀️ Accès interdit au local technique de la piscine. Ne pas manipuler la pompe ni les vannes. Un tuyau est à disposition pour compenser l’évaporation de l’eau en été
❌ Ne pas démonter ni ouvrir ni arracher l’alarme de la piscine : un règlement est fourni sur la porte du local technique pour son utilisation.
🔥 Sécurité incendie : feux d’artifice, pétards et fumigènes interdits
🍗 Barbecue autorisé sauf par vent fort : charbon non fourni. Merci de laisser le barbecue propre et de vider les cendres froides dans un sac poubelle (ne pas jeter dans le jardin).
🐶 Animaux acceptés avec supplément de 10 euros par chien et par nuit à payer à votre arrivée
✅ Produits fournis : savon, shampoing, cafetière à filtre (café moulu), filtres, éponge, torchon, produits ménagers, papier toilette, sel, poivre, sucre, produit vaisselle, pastilles lave-vaisselle, sopalin
🚰 Prévoir des packs d’eau potable (eau du forage). 🫧 Lessive non fournie
🕯️ Poêle à bois en option : 40 € (1/4 de stère + sac bois d’allumage + allume-feu). À réserver avant l’arrivée.
🛣️ Route d’accès : piste en terre sur 2 minutes, déconseillée aux voitures très basses.
📍 Arrivée entre 16h et 18h (possibilité en début de journée avec supplément de 70 €, selon disponibilités).
📍 Départ à 10h maximum avec check-out obligatoire. La maison doit être libre et vide des locataires et de leurs bagages à 10h au plus tard par respect pour les arrivants. Si vous souhaitez partir plus tôt, nous viendrons vérifier la maison. Départ en fin de journée possible avec supplément de 70 € (selon disponibilités).`}
          </AnnexeBlock>

          {/* SIGNATURE ÉLECTRONIQUE OTP */}
          <section className="mt-12 border-t-4 border-[#06243D] pt-10 text-slate-900">
            <h2 className="text-xl font-black uppercase mb-6">Signature Électronique Sécurisée</h2>
            
            <div className="space-y-4 mb-8">
              <label className="flex items-start gap-3 text-sm font-bold cursor-pointer">
                <input type="checkbox" className="h-5 w-5 mt-1" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} disabled={isSigned} />
                <span>J'accepte l'intégralité du contrat et du règlement intérieur (Annexe 3).</span>
              </label>
              <label className="flex items-start gap-3 text-sm font-bold cursor-pointer">
                <input type="checkbox" className="h-5 w-5 mt-1" checked={certifiedInsurance} onChange={e => setCertifiedInsurance(e.target.checked)} disabled={isSigned} />
                <span>Je certifie être couvert par une assurance responsabilité civile villégiature (Article 17).</span>
              </label>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border-2 border-dashed border-slate-200 mb-8">
              <h3 className="font-bold mb-2">Pourquoi un code de signature ?</h3>
              <p className="text-sm text-slate-600">Pour garantir l'identité du signataire, nous envoyons un <strong>code unique à 6 chiffres</strong> par email. Cela sécurise juridiquement votre engagement.</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 font-bold">
                <span>Fait à Carcès, le :</span>
                <input type="text" placeholder="JJ/MM/AAAA" className="border p-2 w-40 bg-white" value={contractDate} onChange={e => setContractDate(e.target.value)} disabled={isSigned} />
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