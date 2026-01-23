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

export default function ContractPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractData | null>(null);

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

    const checkin = (d?.start_date || "").trim();
    const checkout = (d?.end_date || "").trim();
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

    // On affiche uniquement si le montant est > 0 ou défini (et non null/undefined).
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

  const contractText = useMemo(() => {
    if (!data) return "";

    const { name, email, phone, checkin, checkout, nights, adults, children, animals } = normalized;

    const nNights = nights || 0;

    const linesPricing = optionsLines
      .map((l) => `- ${l.label} : ${formatEUR(l.value || 0)}`)
      .join("\n");

    const total = formatEUR(pricing.total);
    const dep = formatEUR(deposit);
    const bal = formatEUR(balance);

    return `CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS — N° [XXXX]

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : [à compléter]
Adresse : [à compléter]
E-mail : [à compléter]
Téléphone : [à compléter]

Locataire
Nom / Prénom : ${name || "[ ]"}
Adresse : [à compléter]
E-mail : ${email || "[ ]"}
Téléphone : ${phone || "[ ]"}

2) Logement loué
Désignation : Location saisonnière meublée
Adresse du logement : [____________________]
Capacité maximale : 8 personnes (voir Article 14).
Le logement est loué à titre de résidence de vacances. Le locataire ne pourra s’en prévaloir comme résidence principale.

3) Durée — Dates — Horaires
Période : du ${checkin || "[date arrivée]"} au ${checkout || "[date départ]"} pour ${nNights || "[X]"} nuit(s).
Arrivée (check-in) : entre 16h et 18h
Départ (check-out) : au plus tard 10h (logement libre de personnes et bagages)

4) Données issues de la demande (non modifiables)
Voyageurs : ${safeInt(adults)} adulte(s) / ${safeInt(children)} enfant(s)
Animaux : ${animals}

5) Prix — Estimation (non modifiable)
${linesPricing ? `Détail :\n${linesPricing}\n` : ""}TOTAL estimé : ${total}
Acompte (30%) : ${dep}
Solde restant : ${bal}

(Le texte complet du contrat sera collé ici mot pour mot à l’étape suivante, avec champs obligatoires + signature en ligne.)`;
  }, [data, normalized, optionsLines, pricing.total, deposit, balance]);

  return (
    <main className="min-h-screen">
      {/* Bandeau haut */}
      <section className="px-5 py-10 bg-gradient-to-b from-[#0b1b3a] to-[#0a1020] text-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold">Contrat de location</h1>
          <p className="opacity-80 mt-2">
            Cette page pré-remplit le contrat à partir de votre demande.
            <b> Les tarifs et informations importantes sont verrouillés</b> et ne peuvent pas être modifiés.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-5 py-10 bg-white">
        <div className="max-w-3xl mx-auto">
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
                <h2 className="text-lg font-semibold">Récapitulatif (verrouillé)</h2>
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
                      <b>Total estimé :</b> {formatEUR(pricing.total)}
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

              {/* Infos locataire (read-only) */}
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Informations locataire (verrouillées)</h2>

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Nom / Prénom</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.name}
                      readOnly
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">E-mail</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.email}
                      readOnly
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Téléphone</span>
                    <input
                      className="border rounded-xl px-3 py-2 bg-slate-50 text-slate-700"
                      value={normalized.phone}
                      readOnly
                    />
                  </label>
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  Ces informations proviennent de la demande initiale. Si une correction est nécessaire, elle devra être demandée par message.
                </div>
              </div>

              {/* Contrat (aperçu texte) */}
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Contrat (aperçu)</h2>
                <p className="text-sm text-slate-600 mt-2">
                  V1 : aperçu lisible + données verrouillées. Étape suivante : contrat complet mot pour mot + champs obligatoires + signature.
                </p>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-6">
                  {contractText}
                </div>

                <div className="mt-5">
                  <button
                    className="px-4 py-3 rounded-xl bg-slate-200 text-slate-500 cursor-not-allowed"
                    disabled
                  >
                    Signature en ligne (étape suivante)
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    Ce bouton sera activé après intégration du contrat complet + validation des champs + signature.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
