"use client";

import { useMemo, useState } from "react";
import type { TourismItem } from "../types";

type Props = {
  items: TourismItem[];
};

/**
 * ✅ TOURISME — Version PRO (compact + très visuel)
 * - Fond bleu conservé
 * - Cartes compactes (peu de hauteur)
 * - Accordéon (1 ouvert à la fois) + animations (hover, chevron, slide)
 * - Typo sobre / pro (dans l’esprit du bloc “Information”)
 */
export default function TourismSection({ items }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const itemsSafe = useMemo(
    () => (Array.isArray(items) ? items.filter(Boolean) : []),
    [items]
  );

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const getPreview = (text: string) => {
    const t = (text ?? "").trim();
    if (!t) return "";
    const firstSentence = t.split(/(?<=[.!?])\s+/)[0] ?? t;
    return firstSentence.length > 140
      ? `${firstSentence.slice(0, 140).trim()}…`
      : firstSentence;
  };

  return (
    <section className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#0a2a3c] to-[#051a2b]">
      <div className="mx-auto max-w-6xl px-6 py-14" id="tourisme">
        <div className="relative overflow-hidden rounded-[44px] bg-white p-8 shadow-sm ring-1 ring-white/10 sm:p-10">
          {/* glow léger (pro, discret) */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#0b2a3a]/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-28 -bottom-28 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

          {/* Header */}
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 ring-1 ring-slate-200">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white ring-1 ring-slate-200">
                  🧭
                </span>
                TOURISME
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Tourisme à Carcès et alentours
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Des idées de lieux nature et de balades. Ouvre une carte pour
                voir le détail, sans surcharger la page.
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 sm:mt-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">
                <span className="text-slate-700 font-semibold">
                  {itemsSafe.length}
                </span>
                lieu{itemsSafe.length > 1 ? "x" : ""}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Cliquer pour dérouler</span>
            </div>
          </div>

          {/* Grid compact */}
          <div className="relative mt-8 grid gap-4 lg:grid-cols-2">
            {itemsSafe.map((t, idx) => {
              const key = `${idx}-${t.title}`;
              const isOpen = openKey === key;
              const preview = getPreview(t.description);

              return (
                <div
                  key={key}
                  className={[
                    "group rounded-3xl border bg-white shadow-sm transition",
                    "ring-1 ring-slate-200",
                    "hover:-translate-y-0.5 hover:shadow-md",
                  ].join(" ")}
                >
                  {/* Header clickable */}
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-4 p-5">
                      {/* Icon badge */}
                      <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-xl ring-1 ring-slate-200">
                        {isOpen ? "✨" : "📍"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900">
                              {t.title}
                            </div>

                            {t.subtitle ? (
                              <div className="mt-1 text-sm text-slate-600">
                                {t.subtitle}
                              </div>
                            ) : null}
                          </div>

                          {/* Chevron */}
                          <div
                            className={[
                              "mt-1 grid h-9 w-9 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-200 transition",
                              isOpen ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            <span className="text-slate-700">⌄</span>
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {typeof t.recommendedByLocals === "number" ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                              ⭐ {t.recommendedByLocals} recommandé(s)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              🌿 Nature & balade
                            </span>
                          )}

                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            ⏱️ {isOpen ? "Fermer" : "Voir le détail"}
                          </span>
                        </div>

                        {/* Preview (quand fermé) */}
                        {!isOpen ? (
                          <p className="mt-3 text-sm leading-relaxed text-slate-700">
                            {preview}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {/* Content animé */}
                  <div
                    className={[
                      "grid transition-all duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    ].join(" ")}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-slate-200 px-5 pb-5 pt-4">
                        <p className="text-sm leading-relaxed text-slate-700">
                          {t.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            Astuce : ça reste compact, tu déroules seulement ce
                            que tu veux lire.
                          </div>

                          <button
                            type="button"
                            onClick={() => setOpenKey(null)}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0b2a3a] px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:brightness-110"
                          >
                            Fermer ↑
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer micro */}
          <div className="relative mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Conseil :</span>{" "}
            pour les meilleures ambiances, privilégie tôt le matin ou fin de
            journée.
          </div>
        </div>
      </div>
    </section>
  );
}
