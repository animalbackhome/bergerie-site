"use client";

import { useEffect, useMemo, useState } from "react";

type ContractData = {
  id: string;

  // Infos issues de la demande (read-only)
  name: string | null;
  email: string | null;
  phone: string | null;

  start_date: string | null;
  end_date: string | null;
  nights: number | null;

  adults: number | null;
  children: number | null;

  animals_count: number | null;
  animal_type: string | null;
  other_animal_label: string | null;

  // pricing (read-only, server-owned)
  pricing: any | null;
};

type Occupant = { fullName: string; age: string };

function formatEUR(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function calcDeposit(total: number) {
  // 30% acompte, arrondi à 2 décimales
  const d = Math.round(total * 0.3 * 100) / 100;
  return d;
}

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toDisplayDateFR(isoOrEmpty: string) {
  // On garde simple : si c’est déjà une date ISO (YYYY-MM-DD), on l’affiche au format JJ/MM/AAAA.
  const s = (isoOrEmpty || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/**
 * IMPORTANT :
 * - Tu colles ici TON CONTRAT COMPLET "mot pour mot" + tes annexes.
 * - Tu peux utiliser ces tokens (ils seront remplacés automatiquement) :
 *   {{CONTRACT_NUMBER}}, {{GUEST_NAME}}, {{GUEST_EMAIL}}, {{GUEST_PHONE}}
 *   {{GUEST_ADDRESS_LINE1}}, {{GUEST_POSTAL_CODE}}, {{GUEST_CITY}}, {{GUEST_COUNTRY}}
 *   {{CHECKIN_DATE}}, {{CHECKOUT_DATE}}, {{NIGHTS}}
 *   {{ADULTS}}, {{CHILDREN}}, {{ANIMALS_SUMMARY}}
 *   {{TOTAL}}, {{DEPOSIT}}, {{BALANCE}}
 *   {{PRICING_LINES}}
 *   {{OCCUPANTS_TABLE}}
 */

const CONTRACT_MAIN_TEXT = `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS — N° {{CONTRACT_NUMBER}}

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : [à compléter]
Adresse : [à compléter]
E-mail : [à compléter]
Téléphone : [à compléter]

Locataire
Nom / Prénom : {{GUEST_NAME}}
Adresse : {{GUEST_ADDRESS_LINE1}}, {{GUEST_POSTAL_CODE}} {{GUEST_CITY}}, {{GUEST_COUNTRY}}
E-mail : {{GUEST_EMAIL}}
Téléphone : {{GUEST_PHONE}}

Le locataire déclare être majeur et avoir la capacité de contracter.

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : [____________________]
Capacité maximale : 8 personnes (voir Article 14).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

Annexes (faisant partie intégrante du contrat) :
Annexe 1 : État descriptif du logement (repris du site)
Annexe 2 : Inventaire / liste équipements (repris du site)
Annexe 3 : Règlement intérieur (repris et signé)
Annexe 4 : État des lieux d’entrée / sortie (à signer sur place)

3) Durée — Dates — Horaires
Période : du {{CHECKIN_DATE}} au {{CHECKOUT_DATE}} pour {{NIGHTS}} nuit(s).
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)

Options (si accord préalable et selon disponibilités) :
Arrivée début de journée : +70€
Départ fin de journée : +70€

4) Personnes présentes dans le logement (obligatoire)
{{OCCUPANTS_TABLE}}

5) Données issues de la demande (non modifiables)
Voyageurs : {{ADULTS}} adulte(s) / {{CHILDREN}} enfant(s)
Animaux : {{ANIMALS_SUMMARY}}

6) Prix — Taxes — Prestations (NON MODIFIABLES)
{{PRICING_LINES}}
TOTAL du séjour : {{TOTAL}}
Acompte (30%) : {{DEPOSIT}}
Solde restant : {{BALANCE}}

(Colle ici le reste de ton contrat complet mot pour mot : Articles 7 à 20 + signatures, sans changer une phrase.)`;

const ANNEXE_1 = `ANNEXE 1 — ÉTAT DESCRIPTIF DU LOGEMENT
(À COLLER ICI MOT POUR MOT — repris du site)
`;

const ANNEXE_2 = `ANNEXE 2 — INVENTAIRE / ÉQUIPEMENTS
(À COLLER ICI MOT POUR MOT — repris du site)
`;

const ANNEXE_3 = `ANNEXE 3 — RÈGLEMENT INTÉRIEUR (à signer)
(À COLLER ICI MOT POUR MOT — règlement complet)
`;

const ANNEXE_4 = `ANNEXE 4 — ÉTAT DES LIEUX D’ENTRÉE / SORTIE
(Signature sur place)
`;

function buildOccupantsTable(occupants: Occupant[]) {
  if (!occupants.length) return "- [ ] (aucune personne renseignée)";
  const lines = occupants.map((o, idx) => {
    const n = (o.fullName || "").trim() || "[Nom / Prénom]";
    const a = (o.age || "").trim() || "[Âge]";
    return `${idx + 1}. ${n} — ${a} ans`;
  });
  return lines.join("\n");
}

function replaceTokens(template: string, map: Record<string, string>) {
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

export default function ContractPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractData | null>(null);

  // Champs locataire (modifiables)
  const [addrLine1, setAddrLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  // Personnes + âge (obligatoire)
  const [occupants, setOccupants] = useState<Occupant[]>([{ fullName: "", age: "" }]);

  // Validation (simple)
  const [acceptRules, setAcceptRules] = useState(false);

  const rid = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return url.searchParams.get("rid") || "";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      if (!rid) {
        setLoading(false);
        setError("Lien invalide : paramètre rid manquant.");
        return;
      }

      try {
        const res = await fetch(`/api/contract?rid=${encodeURIComponent(rid)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          data?: ContractData;
        };

        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error || "Impossible de charger la demande.");
        }

        if (cancelled) return;
        setData(json.data);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || "Erreur inconnue.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [rid]);

  const normalized = useMemo(() => {
    const d = data;

    const name = (d?.name || "").trim();
    const email = (d?.email || "").trim();
    const phone = (d?.phone || "").trim();

    const checkinRaw = (d?.start_date || "").trim();
    const checkoutRaw = (d?.end_date || "").trim();
    const checkin = toDisplayDateFR(checkinRaw);
    const checkout = toDisplayDateFR(checkoutRaw);

    const nights = Number.isFinite(d?.nights as any) ? Number(d?.nights) : 0;

    const adults = Number.isFinite(d?.adults as any) ? Number(d?.adults) : 0;
    const children = Number.isFinite(d?.children as any) ? Number(d?.children) : 0;

    const animalsCount = Number.isFinite(d?.animals_count as any) ? Number(d?.animals_count) : 0;
    const animalType = (d?.animal_type || "").trim();
    const otherLabel = (d?.other_animal_label || "").trim();

    const animals =
      animalsCount <= 0
        ? "0"
        : animalType === "autre" && otherLabel
          ? `${animalsCount} (autre - ${otherLabel})`
          : `${animalsCount} (${animalType || "—"})`;

    return {
      name,
      email,
      phone,
      checkin,
      checkout,
      nights,
      adults,
      children,
      animals,
    };
  }, [data]);

  const expectedOccupantsCount = useMemo(() => {
    const a = safeInt(normalized.adults);
    const c = safeInt(normalized.children);
    return Math.max(0, a + c);
  }, [normalized.adults, normalized.children]);

  // Force exactement le bon nombre de lignes "Personnes" (pour éviter les erreurs)
  useEffect(() => {
    const n = expectedOccupantsCount || 0;
    setOccupants((prev) => {
      const next: Occupant[] = Array.from({ length: n }, (_, i) => prev[i] || { fullName: "", age: "" });
      return next;
    });
  }, [expectedOccupantsCount]);

  const contractNumber = useMemo(() => {
    // Démarre à 28 — format stable, lisible, non devinable.
    const suffix = (rid || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
    return suffix ? `28-${suffix}` : "28";
  }, [rid]);

  const pricing = useMemo(() => {
    const p = data?.pricing || {};
    const total = Number.isFinite(p?.total) ? Number(p.total) : 0;

    return {
      total,
      currency: (p?.currency || "EUR") as string,

      base: Number.isFinite(p?.base_accommodation) ? Number(p.base_accommodation) : undefined,
      cleaning: Number.isFinite(p?.cleaning) ? Number(p.cleaning) : undefined,
      animals: Number.isFinite(p?.animals) ? Number(p.animals) : undefined,
      wood: Number.isFinite(p?.wood) ? Number(p.wood) : undefined,
      visitors: Number.isFinite(p?.visitors) ? Number(p.visitors) : undefined,
      extra_people: Number.isFinite(p?.extra_people) ? Number(p.extra_people) : undefined,
      early_arrival: Number.isFinite(p?.early_arrival) ? Number(p.early_arrival) : undefined,
      late_departure: Number.isFinite(p?.late_departure) ? Number(p.late_departure) : undefined,
      tourist_tax: Number.isFinite(p?.tourist_tax) ? Number(p.tourist_tax) : undefined,
    };
  }, [data]);

  const deposit = useMemo(() => calcDeposit(pricing.total), [pricing.total]);
  const balance = useMemo(() => {
    const b = Math.round((pricing.total - deposit) * 100) / 100;
    return b < 0 ? 0 : b;
  }, [pricing.total, deposit]);

  const optionsLines = useMemo(() => {
    const p = pricing;

    const lines: { label: string; value?: number }[] = [
      { label: "Base hébergement", value: p.base },
      { label: "Ménage (fixe)", value: p.cleaning },
      { label: "Animaux", value: p.animals },
      { label: "Bois (poêle)", value: p.wood },
      { label: "Visiteurs (journée)", value: p.visitors },
      { label: "Personnes supplémentaires (nuits)", value: p.extra_people },
      { label: "Arrivée début de journée", value: p.early_arrival },
      { label: "Départ fin de journée", value: p.late_departure },
      { label: "Taxe de séjour", value: p.tourist_tax },
    ];

    return lines
      .filter((x) => x.value !== undefined && Number.isFinite(x.value))
      .map((x) => ({ ...x, value: Number(x.value) }));
  }, [pricing]);

  const occupantsClean = useMemo(() => {
    return occupants.map((o) => ({
      fullName: (o.fullName || "").trim(),
      age: (o.age || "").trim(),
    }));
  }, [occupants]);

  const occupantsProblems = useMemo(() => {
    const probs: string[] = [];
    if (!data) return probs;

    if ((expectedOccupantsCount || 0) <= 0) {
      probs.push("Demande invalide : nombre de personnes (adultes/enfants) manquant.");
      return probs;
    }

    for (let i = 0; i < occupantsClean.length; i++) {
      const o = occupantsClean[i];
      if (!o.fullName) probs.push(`Personne ${i + 1} : nom/prénom manquant.`);
      const ageNum = Number(o.age);
      if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) probs.push(`Personne ${i + 1} : âge invalide.`);
    }

    if (!addrLine1.trim()) probs.push("Adresse : ligne 1 obligatoire.");
    if (!postalCode.trim()) probs.push("Adresse : code postal obligatoire.");
    if (!city.trim()) probs.push("Adresse : ville obligatoire.");
    if (!country.trim()) probs.push("Adresse : pays obligatoire.");

    if (!acceptRules) probs.push("Vous devez confirmer avoir lu et accepté le règlement intérieur.");

    return probs;
  }, [data, occupantsClean, expectedOccupantsCount, addrLine1, postalCode, city, country, acceptRules]);

  const pricingLinesText = useMemo(() => {
    if (!optionsLines.length) return "Détail :\n- (aucun détail)\n";
    const lines = optionsLines.map((l) => `- ${l.label} : ${formatEUR(l.value || 0)}`).join("\n");
    return `Détail :\n${lines}\n`;
  }, [optionsLines]);

  const contractPreview = useMemo(() => {
    if (!data) return "";

    const tokenMap: Record<string, string> = {
      "{{CONTRACT_NUMBER}}": contractNumber,

      "{{GUEST_NAME}}": normalized.name || "[ ]",
      "{{GUEST_EMAIL}}": normalized.email || "[ ]",
      "{{GUEST_PHONE}}": normalized.phone || "[ ]",

      "{{GUEST_ADDRESS_LINE1}}": addrLine1.trim() || "[ ]",
      "{{GUEST_POSTAL_CODE}}": postalCode.trim() || "[ ]",
      "{{GUEST_CITY}}": city.trim() || "[ ]",
      "{{GUEST_COUNTRY}}": country.trim() || "[ ]",

      "{{CHECKIN_DATE}}": normalized.checkin || "[date arrivée]",
      "{{CHECKOUT_DATE}}": normalized.checkout || "[date départ]",
      "{{NIGHTS}}": String(normalized.nights || 0),

      "{{ADULTS}}": String(safeInt(normalized.adults)),
      "{{CHILDREN}}": String(safeInt(normalized.children)),
      "{{ANIMALS_SUMMARY}}": normalized.animals || "0",

      "{{TOTAL}}": formatEUR(pricing.total),
      "{{DEPOSIT}}": formatEUR(deposit),
      "{{BALANCE}}": formatEUR(balance),

      "{{PRICING_LINES}}": pricingLinesText,
      "{{OCCUPANTS_TABLE}}": buildOccupantsTable(occupantsClean),
    };

    const main = replaceTokens(CONTRACT_MAIN_TEXT, tokenMap);

    return `${main}

${ANNEXE_1}

${ANNEXE_2}

${ANNEXE_3}

${ANNEXE_4}
`;
  }, [data, normalized, contractNumber, addrLine1, postalCode, city, country, pricing.total, deposit, balance, pricingLinesText, occupantsClean]);

  const canPrint = useMemo(() => occupantsProblems.length === 0 && !!data, [occupantsProblems.length, data]);

  function setOccupant(idx: number, patch: Partial<Occupant>) {
    setOccupants((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  return (
    <main className="min-h-screen">
      {/* Bandeau haut */}
      <section className="px-5 py-10 bg-gradient-to-b from-[#0b1b3a] to-[#0a1020] text-white print:hidden">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold">Contrat de location</h1>
          <p className="opacity-80 mt-2">
            Cette page pré-remplit le contrat à partir de votre demande.
            <b> Les tarifs et informations importantes sont verrouillés</b> et ne peuvent pas être modifiés.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-5 py-10 bg-white">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="rounded-2xl border p-5">
              <p className="font-medium">Chargement…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">Erreur</p>
              <p className="text-red-800 mt-1">{error}</p>
            </div>
          ) : !data ? (
            <div className="rounded-2xl border p-5">
              <p className="font-medium">Aucune donnée.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Récap */}
              <div className="rounded-2xl border p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Récapitulatif (verrouillé)</h2>
                  <div className="text-sm text-slate-600">
                    N° contrat : <b>{contractNumber}</b>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div>
                    <b>Séjour :</b> {normalized.checkin} → {normalized.checkout} ({normalized.nights} nuit(s))
                  </div>
                  <div>
                    <b>Voyageurs :</b> {normalized.adults} adulte(s) / {normalized.children} enfant(s)
                  </div>
                  <div>
                    <b>Animaux :</b> {normalized.animals}
                  </div>

                  <div className="mt-3 grid gap-1">
                    {optionsLines.length ? (
                      <>
                        <div className="font-semibold">Détail des prix :</div>
                        {optionsLines.map((l) => (
                          <div key={l.label}>
                            {l.label} : {formatEUR(l.value || 0)}
                          </div>
                        ))}
                      </>
                    ) : null}

                    <div className="mt-2">
                      <b>Total :</b> {formatEUR(pricing.total)}
                    </div>
                    <div>
                      <b>Acompte (30%) :</b> {formatEUR(deposit)}
                    </div>
                    <div>
                      <b>Solde restant :</b> {formatEUR(balance)}
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Les tarifs affichés proviennent de votre demande et sont calculés côté serveur.
                    Ils ne peuvent pas être modifiés par le locataire.
                  </div>
                </div>
              </div>

              {/* Champs locataire (modifiables) */}
              <div className="rounded-2xl border p-5 print:hidden">
                <h2 className="text-lg font-semibold">Informations locataire (à compléter)</h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Nom / Prénom (verrouillé)</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.name}
                      readOnly
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">E-mail (verrouillé)</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.email}
                      readOnly
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Téléphone (verrouillé)</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.phone}
                      readOnly
                    />
                  </label>

                  <div className="hidden sm:block" />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-sm font-medium">Adresse (ligne 1) *</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={addrLine1}
                      onChange={(e) => setAddrLine1(e.target.value)}
                      placeholder="Ex : 12 rue Exemple"
                      autoComplete="street-address"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Code postal *</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Ex : 75001"
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="postal-code"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Ville *</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex : Paris"
                      autoComplete="address-level2"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-sm font-medium">Pays *</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="France"
                      autoComplete="country-name"
                    />
                  </label>
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  Ces informations seront intégrées dans le contrat. Les tarifs et le récapitulatif de la demande restent verrouillés.
                </div>
              </div>

              {/* Personnes + âge (obligatoire) */}
              <div className="rounded-2xl border p-5 print:hidden">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Personnes présentes dans le logement (obligatoire)</h2>
                  <div className="text-sm text-slate-600">
                    À renseigner : <b>{expectedOccupantsCount}</b> personne(s)
                  </div>
                </div>

                <p className="text-sm text-slate-600 mt-2">
                  Le nombre de personnes est verrouillé par la demande : {safeInt(normalized.adults)} adulte(s) / {safeInt(normalized.children)} enfant(s).
                </p>

                <div className="mt-4 grid gap-3">
                  {occupants.map((o, idx) => (
                    <div key={idx} className="grid gap-3 sm:grid-cols-12 items-end">
                      <label className="grid gap-1 sm:col-span-8">
                        <span className="text-sm font-medium">Nom / Prénom</span>
                        <input
                          className="border rounded-xl px-3 py-2"
                          value={o.fullName}
                          onChange={(e) => setOccupant(idx, { fullName: e.target.value })}
                          placeholder="Ex : Marie Dupont"
                        />
                      </label>

                      <label className="grid gap-1 sm:col-span-4">
                        <span className="text-sm font-medium">Âge</span>
                        <input
                          className="border rounded-xl px-3 py-2"
                          value={o.age}
                          onChange={(e) => setOccupant(idx, { age: e.target.value })}
                          placeholder="Ex : 35"
                          inputMode="numeric"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-start gap-2">
                  <input
                    id="acceptRules"
                    type="checkbox"
                    className="mt-1"
                    checked={acceptRules}
                    onChange={(e) => setAcceptRules(e.target.checked)}
                  />
                  <label htmlFor="acceptRules" className="text-sm">
                    Je confirme avoir lu et accepté le règlement intérieur (Annexe 3).
                  </label>
                </div>

                {occupantsProblems.length ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="font-semibold text-amber-900">À corriger avant impression</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                      {occupantsProblems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Contrat complet + annexes (aperçu) */}
              <div className="rounded-2xl border p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Contrat complet + annexes</h2>
                  <div className="flex gap-2 print:hidden">
                    <button
                      type="button"
                      className={`rounded-xl px-4 py-2 text-sm ${
                        canPrint ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                      }`}
                      disabled={!canPrint}
                      onClick={() => window.print()}
                    >
                      Imprimer / PDF
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mt-2 print:hidden">
                  Cette version affiche déjà la structure complète + annexes. Étape suivante : tu colles ton contrat et tes annexes
                  “mot pour mot” dans les constantes en haut du fichier (CONTRACT_MAIN_TEXT + ANNEXE_1..4).
                </p>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{contractPreview}</div>

                <div className="mt-4 text-xs text-slate-500 print:hidden">
                  Les montants affichés sont verrouillés (calcul serveur). L’adresse + les personnes + âges sont les seuls champs modifiables ici.
                </div>
              </div>

              {/* Signature en ligne (plus tard) */}
              <div className="rounded-2xl border p-5 print:hidden">
                <h2 className="text-lg font-semibold">Signature en ligne</h2>
                <p className="text-sm text-slate-600 mt-2">
                  Étape suivante : on active la signature (et l’envoi du double signé + RIB + acompte/solde).
                </p>
                <button className="mt-4 px-4 py-3 rounded-xl bg-slate-200 text-slate-500 cursor-not-allowed" disabled>
                  Signer le contrat (à venir)
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
