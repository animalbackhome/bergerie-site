"use client";

import { useMemo, useState } from "react";

type PaymentKey =
  | "contrat"
  | "paiement"
  | "caution"
  | "animaux"
  | "horaires"
  | "menage";

type Card = {
  key: PaymentKey;
  title: string;
  badge: string;
  icon: string;
  short: string;
  detailTitle: string;
  detailText: string;
  tip?: string;
};

type RateLine = { label: string; value: string; note?: string };
type RateGroup = { title: string; lines: RateLine[] };

export default function PaiementSection() {
  const cards: Card[] = useMemo(
    () => [
      {
        key: "contrat",
        title: "Contrat",
        badge: "Formalités",
        icon: "📝",
        short: "Contrat & signature en ligne avant l’entrée dans les lieux.",
        detailTitle: "Contrat",
        detailText:
          "Contrat et signature en ligne avant l’entrée dans les lieux (simple, sécurisé, et clair).",
        tip: "Astuce : préparez vos dates + le nombre de voyageurs pour aller plus vite.",
      },
      {
        key: "paiement",
        title: "Paiement",
        badge: "Réservation",
        icon: "💳",
        short: "30% à la réservation puis solde 7 jours avant l’arrivée.",
        detailTitle: "Paiement",
        detailText:
          "30% à la réservation par virement bancaire, puis le solde 7 jours avant l’entrée dans les lieux.",
        tip: "Astuce : cliquez sur TARIFS pour découvrir les prix + options.",
      },
      {
        key: "caution",
        title: "Caution",
        badge: "Sécurité",
        icon: "🔒",
        short: "500 € en liquide à l’arrivée (pas de chèque).",
        detailTitle: "Caution",
        detailText: "Caution : 500 € à remettre à l’arrivée (chèque non acceptés).",
        tip: "Astuce : préparez la caution la caution avant votre arrivée pour un check-in rapide ( Aucun entrée dans les lieux sans caution).",
      },

      // ✅ AJOUT : CARTE "MÉNAGE" (100 € fixe / séjour)
      {
        key: "menage",
        title: "Ménage",
        badge: "Frais fixes",
        icon: "🧼",
        short: "100 € (quel que soit le nombre de nuits).",
        detailTitle: "Ménage",
        detailText:
          "Frais de ménage : 100 € quel que soit le nombre de nuits (forfait fixe par séjour).",
        tip: "Astuce : ce forfait s’ajoute au total du séjour, indépendamment de la durée.",
      },

      {
        key: "animaux",
        title: "Animaux",
        badge: "Accueil",
        icon: "🐾",
        short: "+10 €/nuit/animal, sans limite (propreté exigée).",
        detailTitle: "Animaux",
        detailText:
          "+10 € par animal et par nuit, sans limite. Propreté exigée : ramassage des excréments, aucune dégradation, interdiction de monter sur les lits et canapés.",
        tip: "Astuce : indiquez clairement le nombre d’animaux dans votre demande.",
      },
      {
        key: "horaires",
        title: "Horaires",
        badge: "Check-in/out",
        icon: "⏰",
        short: "Arrivée 16h–18h • Départ 10h. Options d’horaires possibles.",
        detailTitle: "Horaires",
        detailText:
          "Arrivée entre 16h et 18h, départ à 10h.\nOptions : arrivée en début de journée (+70 €) / départ en fin de journée (+70 €) selon disponibilité.",
        tip: "Pour gagner du temps : cliquez sur TARIFS, puis utilisez le formulaire de Contact pour faire votre demande de réservation.",
      },
    ],
    []
  );

  const rateGroups: RateGroup[] = useMemo(
    () => [
      {
        title: "Tarifs par période (par nuit)",
        lines: [
          { label: "Septembre", value: "250 € / nuit" },
          { label: "Octobre → Mars", value: "170 € / nuit", note: "sauf fêtes" },
          { label: "Avril", value: "250 € / nuit" },
          { label: "Mai", value: "300 € / nuit" },
          { label: "Juin", value: "400 € / nuit" },
          { label: "Juillet", value: "450 € / nuit" },
          { label: "Août", value: "500 € / nuit" },
        ],
      },
      {
        title: "Fêtes (par nuit)",
        lines: [
          { label: "Noël", value: "300 € / nuit" },
          { label: "Veille de Noël (24/12)", value: "200 € / nuit" },
          { label: "Lendemain de Noël (26/12)", value: "200 € / nuit" },
          { label: "Jour de l’an", value: "300 € / nuit" },
          { label: "Veille du jour de l’an (31/12)", value: "200 € / nuit" },
          { label: "Lendemain du jour de l’an (02/01)", value: "200 € / nuit" },
        ],
      },
      {
        title: "Options supplémentaires",
        lines: [
          {
            label: "Départ fin de journée (au lieu de 10h)",
            value: "+70 €",
          },
          {
            label: "Arrivée début de journée (au lieu de 16h)",
            value: "+70 €",
          },
          {
            label: "Bois (¼ de stère)",
            value: "+40 €",
            note: "bois d’allumage + bûches + allume-feu + allumettes",
          },
          {
            label: "Animaux",
            value: "+10 € / animal / nuit",
          },
          {
            label: "Personne supplémentaire (visiteur ou qui dort sur place)",
            value: "50 € / personne / visite ou / nuit",
          },
        ],
      },
    ],
    []
  );

  const [activeKey, setActiveKey] = useState<PaymentKey>("horaires");
  const [isRatesOpen, setIsRatesOpen] = useState(false);

  const active = cards.find((c) => c.key === activeKey) ?? cards[0];

  return (
    <section id="paiement" className="w-full bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-[32px] bg-[#0b2a3a] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Paiement &amp; conditions
              </h2>
              <p className="mt-2 text-base text-white/80">
                Tout est clair, simple et sécurisé : cliquez sur chaque carte
                pour afficher le détail.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setIsRatesOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                TARIFS
              </button>

              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full bg-[#0b2a3a] px-5 py-2 text-base font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110"
              >
                Demander une dispo
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.map((c) => {
                const selected = c.key === activeKey;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActiveKey(c.key)}
                    className={[
                      "text-left rounded-3xl p-5 transition ring-4 ring-white",
                      selected
                        ? "bg-[#0a2a3c] shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
                        : "bg-[#0a2a3c] hover:brightness-110",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white ring-1 ring-white/20">
                        <span className="text-lg">{c.icon}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-white">
                            {c.title}
                          </div>
                          <div className="text-white/70">→</div>
                        </div>

                        <div className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/20">
                          {c.badge}
                        </div>

                        <p className="mt-3 text-base leading-relaxed text-white/85">
                          {c.short}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right detail */}
            <div className="rounded-3xl bg-white p-7 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    DÉTAIL
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {active.detailTitle}
                  </div>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                  <span className="text-lg">{active.icon}</span>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-700">
                {active.detailText}
              </p>

              {active.tip ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-base font-semibold text-slate-900">
                    Astuce
                  </div>
                  <p className="mt-1 text-base text-slate-700">{active.tip}</p>
                </div>
              ) : null}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsRatesOpen(true)}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0b2a3a] px-6 text-base font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  Voir les tarifs
                </button>

                <a
                  href="#contact"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Contacter
                </a>
              </div>
            </div>
          </div>

          {/* Modal tarifs */}
          {isRatesOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
              onClick={() => setIsRatesOpen(false)}
            >
              <div
                className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      TARIFS
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                      Prix &amp; options
                    </div>
                    <p className="mt-2 text-base text-slate-600">
                      Tarifs indicatifs par nuit + options (selon disponibilité).
                    </p>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 hover:bg-slate-50"
                    onClick={() => setIsRatesOpen(false)}
                  >
                    Fermer
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  {rateGroups.map((g) => (
                    <div
                      key={g.title}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="text-base font-semibold text-slate-900">
                        {g.title}
                      </div>

                      <div className="mt-4 grid gap-3">
                        {g.lines.map((l) => (
                          <div
                            key={l.label}
                            className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="text-base font-medium text-slate-900">
                              {l.label}
                            </div>
                            <div className="text-base font-semibold text-slate-900">
                              {l.value}
                            </div>
                            {l.note ? (
                              <div className="text-sm text-slate-500 sm:basis-full">
                                {l.note}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    href="#contact"
                    onClick={() => setIsRatesOpen(false)}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0b2a3a] px-6 text-base font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Demander une dispo
                  </a>

                  <button
                    type="button"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    onClick={() => setIsRatesOpen(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
