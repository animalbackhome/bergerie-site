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

  // --- ÉTATS ---
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
    <div className="min-h-screen bg-slate-50 pb-20 text-black font-sans">
      <div className="bg-[#06243D] py-12 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold uppercase italic">Contrat de Location Saisonnière</h1>
          <p className="mt-2 text-blue-200">Bergerie Provençale • Carcès</p>
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-4xl px-6">
        <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
          
          <div className="space-y-12 whitespace-pre-wrap text-sm leading-relaxed">
            {/* 1) PARTIES */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">1) Parties</h2>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="font-bold text-blue-900">Propriétaire (Bailleur)</p>
                  <p>Nom / Prénom : {OWNER.name}</p>
                  <p>Adresse : {OWNER.address}</p>
                  <p>E-mail : {OWNER.email}</p>
                  <p>Téléphone : {OWNER.phone}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="font-bold text-blue-900">Locataire</p>
                  <p>Nom / Prénom : {booking.full_name}</p>
                  <p>E-mail : {booking.email}</p>
                  <p>Téléphone : {booking.phone || "[]"}</p>
                  <div className="mt-4 space-y-2">
                    <input placeholder="Adresse complète *" className="w-full border p-2 rounded" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                    <div className="flex gap-2">
                      <input placeholder="CP *" className="w-1/3 border p-2 rounded" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                      <input placeholder="Ville *" className="w-2/3 border p-2 rounded" value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-4 italic">Le locataire déclare être majeur et avoir la capacité de contracter. Conformément au RGPD, ces données sont utilisées uniquement pour la gestion du contrat.</p>
            </section>

            {/* 2) LOGEMENT */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">2) Logement loué</h2>
              <p>Désignation : Location saisonnière meublée</p>
              <p>Adresse du logement : {PROPERTY_ADDRESS}</p>
              <p>Capacité maximale : 8 personnes (voir Article 11).</p>
              <p>Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.</p>
              <p className="font-bold mt-2">Annexes (faisant partie intégrante du contrat) :</p>
              <p>Annexe 1 : État descriptif du logement (repris du site)</p>
              <p>Annexe 2 : Inventaire / liste équipements (repris du site)</p>
              <p>Annexe 3 : Règlement intérieur (repris et signé)</p>
              <p>Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)</p>
            </section>

            {/* 3) DURÉE */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">3) Durée — Dates — Horaires</h2>
              <p>Période : du {formatDateFR(booking.arrival_date)} au {formatDateFR(booking.departure_date)} pour {nights} nuits.</p>
              <p className="font-bold mt-2">Horaires standard :</p>
              <p>Arrivée (check-in) : entre 16h et 18h</p>
              <p>Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)</p>
              <p className="font-bold mt-2">Options (si accord préalable et selon disponibilités) :</p>
              <p>Arrivée début de journée : +70€</p>
              <p>Départ fin de journée : +70€</p>
            </section>

            {/* 4) PRIX */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">4) Prix — Taxes — Prestations</h2>
              <p className="font-bold">Prix total du séjour : {toMoneyEUR(pricingData.total)} comprenant :</p>
              <p>Hébergement : {toMoneyEUR(pricingData.base)}</p>
              <p>Forfait ménage : {toMoneyEUR(pricingData.menage)}</p>
              <p>Taxe de séjour : {toMoneyEUR(pricingData.taxe)}</p>
              {pricingData.options.map((opt, i) => (
                <p key={i} className="capitalize">+ {opt.label} : {toMoneyEUR(opt.value)}</p>
              ))}
            </section>

            {/* 5) PAIEMENT */}
            <section>
              <h2 className="text-xl font-black text-[#06243D] underline mb-4 uppercase">5) Paiement — Acompte — Solde (VIREMENT UNIQUEMENT)</h2>
              <p>Mode de paiement : virement bancaire uniquement. Aucun paiement par chèque n’est accepté.</p>
              <p className="font-bold mt-2">5.1 Acompte (30%)</p>
              <p>Pour bloquer les dates, le locataire verse un acompte de 30% du prix total, soit {toMoneyEUR(pricingData.acompte)}.</p>
              <p>✅ Les parties conviennent expressément que la somme versée à la réservation constitue un ACOMPTE et non des arrhes.</p>
              <p className="font-bold mt-2">5.2 Solde</p>
              <p>Le solde, soit {toMoneyEUR(pricingData.solde)}, doit être réglé au plus tard 7 jours avant l’entrée dans les lieux.</p>
              <p>À défaut de paiement du solde dans ce délai, et sans réponse dans les 48h suivant l’e-mail de relance, le propriétaire pourra considérer la réservation comme annulée par le locataire, l’acompte restant acquis au propriétaire.</p>
            </section>

            {/* 6 à 20 : CLAUSES INTÉGRALES */}
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-[#06243D] underline mb-2 uppercase">6) Formation du contrat — Réservation</h2>
                <p>La réservation devient effective dès réception du présent contrat signé et de l’acompte de 30%.</p>
              </div>
              <div>
                <h2 className="text-xl font-black text-[#06243D] underline mb-2 uppercase">7) Absence de droit de rétractation</h2>
                <p>Le locataire est informé que, pour une prestation d’hébergement fournie à une date déterminée, il ne bénéficie pas d’un droit de rétractation.</p>
              </div>
              <div>
                <h2 className="text-xl font-black text-[#06243D] underline mb-2 uppercase">8) Annulation / Non-présentation / Séjour écourté</h2>
                <p>8.1 Annulation par le locataire : Toute annulation doit être notifiée par écrit. L’acompte de 30% reste acquis. À compter de J-7, aucun remboursement ne sera effectué.</p>
                <p>8.2 Non-présentation : Au-delà de minuit le jour d'arrivée sans nouvelle, le propriétaire dispose du logement et conserve les sommes.</p>
              </div>
              <div>
                <h2 className="text-xl font-black text-[#06243D] underline mb-2 uppercase">12) Dépôt de garantie (caution) — 500€ (en liquide à l’arrivée)</h2>
                <p>Un dépôt de garantie de 500€ est demandé en liquide à l’arrivée. Il est restitué après l’état des lieux de sortie, déduction faite des éventuelles dégradations.</p>
              </div>
              <div>
                <h2 className="text-xl font-black text-[#06243D] underline mb-2 uppercase">16) Caméras (information)</h2>
                <p>Le locataire est informé de la présence de caméras uniquement sur les accès extérieurs (entrée/accès), à des fins de sécurité. Aucune caméra n’est présente à l’intérieur.</p>
              </div>
            </section>
          </div>

          {/* ANNEXES DYNAMIQUES */}
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-black text-[#06243D] underline mb-4 uppercase">Annexes (Accordéons)</h2>
            <AnnexeBlock title="Annexe 1 : État descriptif complet">
              {`🌿 Bergerie provençale en pierres nichée en pleine forêt à Carcès. Terrain de 3 750 m² sans vis-à-vis. Accès par piste forestière. Villa de 215 m², terrasse de 40 m², grande véranda, piscine au sel.`}
            </AnnexeBlock>
            <AnnexeBlock title="Annexe 2 : Inventaire / Liste équipements">
              {`Cuisine complète (four, lave-vaisselle, micro-ondes), Starlink WiFi, TV Netflix, Terrain de pétanque, badminton, basket. Literie et serviettes fournies.`}
            </AnnexeBlock>
            <AnnexeBlock title="Annexe 3 : Règlement Intérieur (Texte Officiel)" defaultOpen={true}>
              {`▶️ RDV Chapelle Notre Dame pour guidage. ⛔ Fêtes interdites. ‼️ Max 8 pers. 🎦 Caméras extérieures. 🚭 Non-fumeur intérieur. 🚮 Poubelles à emporter. 🍽️ Vaisselle au lave-vaisselle. 🐶 Animaux : 10€/nuit.`}
            </AnnexeBlock>
          </div>

          {/* SIGNATURES */}
          <div className="mt-12 border-t-4 border-[#06243D] pt-10">
            <div className="flex items-start gap-3 mb-6">
              <input type="checkbox" id="sign" className="h-6 w-6 cursor-pointer" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <label htmlFor="sign" className="text-sm font-bold cursor-pointer">Je certifie l'exactitude des informations et j'accepte l'intégralité du contrat, du règlement intérieur et des annexes.</label>
            </div>
            <div className="flex items-center gap-4 font-bold mb-6">
              <span>Fait à Carcès, le :</span>
              <input type="text" placeholder="JJ/MM/AAAA" className="border p-2 w-40" value={contractDate} onChange={e => setContractDate(e.target.value)} />
            </div>
            <button disabled={!acceptedTerms || !token} className="w-full rounded-xl bg-[#06243D] py-5 text-xl font-black text-white uppercase hover:bg-black disabled:opacity-30">Signer le contrat</button>
          </div>

        </div>
      </div>
    </div>
  );
}