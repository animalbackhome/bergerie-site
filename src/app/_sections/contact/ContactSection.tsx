// src/app/_sections/contact/ContactSection.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  hostEmail: string;
  airbnbCalendarUrl?: string;
};

type AnimalType = "chien" | "chat" | "autre";

type Draft = {
  name: string;
  email: string;
  phone: string;

  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (checkout)
  adults: number; // taxe de séjour
  children: number; // -18 ans (exonérés)

  animalType: AnimalType;
  otherAnimalLabel: string;
  animalsCount: number;

  woodQuarterSteres: number; // 0..n (prix 40€ par 1/4 stère)
  visitorsCount: number; // 50€/visiteur (one-shot)

  extraSleepersCount: number; // personnes en plus qui dorment
  extraSleepersNights: number; // nombre de nuits pour ces personnes (<= nights)

  earlyArrival: boolean; // +70
  lateDeparture: boolean; // +70

  message: string;
};

function formatEUR(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function parseISODateLocal(iso: string) {
  // iso: YYYY-MM-DD => date locale à minuit
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function diffNights(startISO: string, endISO: string) {
  const s = parseISODateLocal(startISO);
  const e = parseISODateLocal(endISO);
  if (!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, nights);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKeyMMDD(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/**
 * ✅ Tarifs donnés par toi :
 * - Septembre : 250€/nuit
 * - Octobre → Mars : 170€/nuit (sauf fêtes)
 * - Avril : 250€/nuit
 * - Mai : 300€/nuit
 * - Juin : 400€/nuit
 * - Juillet : 450€/nuit
 * - Août : 500€/nuit
 *
 * Fêtes (par nuit) :
 * - Noël (25/12) : 300€/nuit
 * - Veille de Noël (24/12) : 200€/nuit
 * - Lendemain de Noël (26/12) : 200€/nuit
 * - Jour de l’an (01/01) : 300€/nuit
 * - Veille du jour de l’an (31/12) : 200€/nuit
 * - Lendemain du jour de l’an (02/01) : 200€/nuit
 */
function nightlyRate(date: Date) {
  const holidayRates: Record<string, number> = {
    "12-24": 200,
    "12-25": 300,
    "12-26": 200,
    "12-31": 200,
    "01-01": 300,
    "01-02": 200,
  };

  const key = dateKeyMMDD(date);
  if (holidayRates[key] != null) return holidayRates[key];

  const month = date.getMonth() + 1;

  if (month === 8) return 500; // Août
  if (month === 7) return 450; // Juillet
  if (month === 6) return 400; // Juin
  if (month === 5) return 300; // Mai
  if (month === 4) return 250; // Avril
  if (month === 9) return 250; // Septembre

  // Octobre (10) -> Mars (3)
  if (month === 10 || month === 11 || month === 12 || month === 1 || month === 2 || month === 3)
    return 170;

  // Par défaut (au cas où) : 250
  return 250;
}

function calcBaseAccommodation(startISO: string, endISO: string) {
  const s = parseISODateLocal(startISO);
  const nights = diffNights(startISO, endISO);
  if (!s || nights <= 0) return { base: 0, nightly: [] as { date: Date; rate: number }[] };

  const nightly: { date: Date; rate: number }[] = [];
  let total = 0;

  for (let i = 0; i < nights; i++) {
    const d = addDays(s, i);
    const rate = nightlyRate(d);
    nightly.push({ date: d, rate });
    total += rate;
  }

  return { base: total, nightly };
}

function ChipWhite({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
      <span className="text-base">{icon}</span>
      <span className="text-slate-600">{label} :</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function ContactSection({
  hostEmail,
  airbnbCalendarUrl = "https://www.airbnb.fr/rooms/867121310852790122?guests=1&adults=1&s=67&unique_share_id=a77ffe87-87a5-4730-8e31-cebf52ed6508",
}: Props) {
  const [draft, setDraft] = useState<Draft>({
    name: "",
    email: "",
    phone: "",

    startDate: "",
    endDate: "",
    adults: 2,
    children: 0,

    animalType: "chien",
    otherAnimalLabel: "",
    animalsCount: 0,

    woodQuarterSteres: 0,
    visitorsCount: 0,

    extraSleepersCount: 0,
    extraSleepersNights: 0,

    earlyArrival: false,
    lateDeparture: false,

    message: "",
  });

  const nights = useMemo(() => diffNights(draft.startDate, draft.endDate), [draft.startDate, draft.endDate]);

  const accommodation = useMemo(() => calcBaseAccommodation(draft.startDate, draft.endDate), [draft.startDate, draft.endDate]);

  const animalLabel = useMemo(() => {
    if (draft.animalsCount <= 0) return "—";
    if (draft.animalType === "chien") return `${draft.animalsCount} chien(s)`;
    if (draft.animalType === "chat") return `${draft.animalsCount} chat(s)`;
    const other = draft.otherAnimalLabel.trim().length ? ` (${draft.otherAnimalLabel.trim()})` : "";
    return `${draft.animalsCount} autre(s)${other}`;
  }, [draft.animalsCount, draft.animalType, draft.otherAnimalLabel]);

  const travelersLabel = useMemo(() => {
    const a = Math.max(0, Number(draft.adults) || 0);
    const c = Math.max(0, Number(draft.children) || 0);
    if (a === 0 && c === 0) return "—";
    if (c === 0) return `${a} adulte(s)`;
    if (a === 0) return `${c} enfant(s)`;
    return `${a} adulte(s) + ${c} enfant(s)`;
  }, [draft.adults, draft.children]);

  const datesLabel = useMemo(() => {
    if (!draft.startDate || !draft.endDate || nights <= 0) return "—";
    const s = parseISODateLocal(draft.startDate);
    const e = parseISODateLocal(draft.endDate);
    if (!s || !e) return "—";
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "");
    return `${fmt(s)} → ${fmt(e)} (${nights} nuit${nights > 1 ? "s" : ""})`;
  }, [draft.startDate, draft.endDate, nights]);

  const pricing = useMemo(() => {
    const cleaningFee = 100;

    const animalsCost = Math.max(0, draft.animalsCount) * 10 * Math.max(0, nights);
    const woodCost = Math.max(0, draft.woodQuarterSteres) * 40;
    const visitorsCost = Math.max(0, draft.visitorsCount) * 50;

    const extraNights = Math.min(Math.max(0, draft.extraSleepersNights), Math.max(0, nights));
    const extraSleepersCost = Math.max(0, draft.extraSleepersCount) * 50 * extraNights;

    const earlyArrivalCost = draft.earlyArrival ? 70 : 0;
    const lateDepartureCost = draft.lateDeparture ? 70 : 0;

    const touristTax = Math.max(0, draft.adults) * Math.max(0, nights) * 3.93;

    const base = accommodation.base;

    const total =
      base +
      cleaningFee +
      animalsCost +
      woodCost +
      visitorsCost +
      extraSleepersCost +
      earlyArrivalCost +
      lateDepartureCost +
      touristTax;

    return {
      base,
      cleaningFee,
      animalsCost,
      woodCost,
      visitorsCost,
      extraSleepersCost,
      earlyArrivalCost,
      lateDepartureCost,
      touristTax,
      total,
      extraNights,
    };
  }, [
    accommodation.base,
    draft.animalsCount,
    draft.woodQuarterSteres,
    draft.visitorsCount,
    draft.extraSleepersCount,
    draft.extraSleepersNights,
    draft.earlyArrival,
    draft.lateDeparture,
    draft.adults,
    nights,
  ]);

  return (
    <section
      id="contact"
      data-component="ContactSection-vB-pricing"
      className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#0a2a3c] to-[#051a2b]"
    >
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Frame / glow */}
        <div className="relative rounded-[32px] border border-white/12 bg-white/10 p-1 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(closest-side,rgba(31,111,163,0.30),transparent)]" />

          <div className="relative overflow-hidden rounded-[28px] bg-white">
            {/* Header (✅ couleur différente du fond : plus claire/teal) */}
            <div className="bg-gradient-to-r from-[#0f3b50] via-[#0b3347] to-[#082a3c] px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    {/* ✅ bulle fond blanc */}
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold tracking-widest text-slate-900">
                      CONTACT &amp; RÉSERVATION
                    </span>

                    <span className="inline-flex items-center rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-300/30">
                      V2
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-300 motion-safe:animate-pulse" />
                    </span>
                  </div>

                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Contacter
                  </h2>

                  <p className="mt-2 text-base leading-relaxed text-white/85">
                    Sélectionnez vos dates, indiquez le nombre de voyageurs, les animaux et les options.
                    Le prix estimé s’affiche à droite automatiquement.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={airbnbCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/15 whitespace-nowrap"
                  >
                    Voir le calendrier Airbnb
                  </Link>

                  <a
                    href="#paiement"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 whitespace-nowrap"
                  >
                    Voir Paiement &amp; conditions
                  </a>
                </div>
              </div>

              {/* ✅ bulles fond blanc */}
              <div className="mt-6 flex flex-wrap gap-2">
                <ChipWhite icon="📅" label="Dates" value={datesLabel} />
                <ChipWhite icon="👥" label="Voyageurs" value={travelersLabel} />
                <ChipWhite icon="🐾" label="Animaux" value={animalLabel} />
              </div>
            </div>

            {/* Content */}
            <div className="grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.05fr_0.95fr]">
              {/* Form */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-widest text-slate-500">
                      FORMULAIRE
                    </div>
                    <p className="mt-1 text-base text-slate-600">
                      Les champs ci-dessous mettent à jour le résumé et le prix en temps réel.
                    </p>
                  </div>

                  {/* ✅ bulle enveloppe fond bleu */}
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b2a3a] ring-1 ring-white/10 shadow-sm">
                    <span className="text-lg text-white">✉️</span>
                  </div>
                </div>

                <form
                  className="mt-6 grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();

                    const subject = encodeURIComponent("Demande de disponibilité — Bergerie");
                    const body = encodeURIComponent(
                      [
                        `Nom: ${draft.name}`,
                        `Email: ${draft.email}`,
                        `Téléphone: ${draft.phone || "—"}`,
                        ``,
                        `Séjour: ${datesLabel}`,
                        `Voyageurs: ${travelersLabel}`,
                        `Animaux: ${animalLabel}`,
                        ``,
                        `Options:`,
                        `- Arrivée début de journée: ${draft.earlyArrival ? "Oui (+70€)" : "Non"}`,
                        `- Départ fin de journée: ${draft.lateDeparture ? "Oui (+70€)" : "Non"}`,
                        `- Bois: ${draft.woodQuarterSteres} x 1/4 stère (40€ / 1/4) => ${formatEUR(pricing.woodCost)}`,
                        `- Visiteurs (ne dorment pas): ${draft.visitorsCount} x 50€ => ${formatEUR(pricing.visitorsCost)}`,
                        `- Personnes en plus qui dorment: ${draft.extraSleepersCount} pers. x ${pricing.extraNights} nuit(s) x 50€ => ${formatEUR(pricing.extraSleepersCost)}`,
                        ``,
                        `Détail prix:`,
                        `- Base hébergement: ${formatEUR(pricing.base)}`,
                        `- Ménage (fixe): ${formatEUR(pricing.cleaningFee)}`,
                        `- Animaux: ${formatEUR(pricing.animalsCost)}`,
                        `- Bois: ${formatEUR(pricing.woodCost)}`,
                        `- Visiteurs: ${formatEUR(pricing.visitorsCost)}`,
                        `- Personnes en plus (nuits): ${formatEUR(pricing.extraSleepersCost)}`,
                        `- Arrivée tôt: ${formatEUR(pricing.earlyArrivalCost)}`,
                        `- Départ tard: ${formatEUR(pricing.lateDepartureCost)}`,
                        `- Taxe de séjour (3,93€/adulte/nuit): ${formatEUR(pricing.touristTax)}`,
                        `= TOTAL estimé: ${formatEUR(pricing.total)}`,
                        ``,
                        `Message:`,
                        draft.message || "—",
                        ``,
                        `Lien Airbnb (calendrier): ${airbnbCalendarUrl}`,
                      ].join("\n")
                    );

                    window.location.href = `mailto:${hostEmail}?subject=${subject}&body=${body}`;
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Nom</span>
                      <input
                        required
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Votre nom"
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Email</span>
                      <input
                        type="email"
                        required
                        value={draft.email}
                        onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                        placeholder="vous@email.com"
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">Téléphone (optionnel)</span>
                    <input
                      value={draft.phone}
                      onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                      placeholder="06..."
                      className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                    />
                  </label>

                  {/* ✅ Calendrier (date inputs) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Date d’arrivée</span>
                      <input
                        type="date"
                        required
                        value={draft.startDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((d) => {
                            // si endDate existe et devient invalide, on la vide
                            const nightsNow = diffNights(v, d.endDate);
                            return {
                              ...d,
                              startDate: v,
                              endDate: d.endDate && nightsNow <= 0 ? "" : d.endDate,
                            };
                          });
                        }}
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Date de départ</span>
                      <input
                        type="date"
                        required
                        value={draft.endDate}
                        min={draft.startDate || undefined}
                        onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>
                  </div>

                  {/* ✅ Taxe de séjour : adultes / enfants */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Adultes (taxe de séjour)</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.adults}
                        onChange={(e) => setDraft((d) => ({ ...d, adults: Number(e.target.value || 0) }))}
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Enfants (-18 ans)</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.children}
                        onChange={(e) => setDraft((d) => ({ ...d, children: Number(e.target.value || 0) }))}
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                      <span className="text-xs text-slate-500">
                        Enfants &lt; 18 ans : exonérés (taxe de séjour).
                      </span>
                    </label>
                  </div>

                  {/* ✅ Animaux détaillés */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Type d’animal</span>
                      <select
                        value={draft.animalType}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, animalType: e.target.value as AnimalType }))
                        }
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      >
                        <option value="chien">Chien</option>
                        <option value="chat">Chat</option>
                        <option value="autre">Autre</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Nombre d’animaux</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.animalsCount}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, animalsCount: Number(e.target.value || 0) }))
                        }
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>
                  </div>

                  {draft.animalType === "autre" && draft.animalsCount > 0 ? (
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Précisez “autre animal”</span>
                      <input
                        value={draft.otherAnimalLabel}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, otherAnimalLabel: e.target.value }))
                        }
                        placeholder="Ex : lapin, tortue..."
                        className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                      />
                    </label>
                  ) : null}

                  {/* ✅ Options */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-semibold text-slate-900">Options</div>

                    <div className="mt-4 grid gap-4">
                      <label className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Arrivée début de journée (au lieu de 16h)
                          </div>
                          <div className="text-xs text-slate-600">+70€ (si possible)</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.earlyArrival}
                          onChange={(e) => setDraft((d) => ({ ...d, earlyArrival: e.target.checked }))}
                          className="h-5 w-5"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Départ fin de journée (au lieu de 10h)
                          </div>
                          <div className="text-xs text-slate-600">+70€ (si possible)</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={draft.lateDeparture}
                          onChange={(e) => setDraft((d) => ({ ...d, lateDeparture: e.target.checked }))}
                          className="h-5 w-5"
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Bois (¼ stère) — 40€ / ¼
                          </span>
                          <select
                            value={draft.woodQuarterSteres}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, woodQuarterSteres: Number(e.target.value || 0) }))
                            }
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
                          >
                            <option value={0}>0</option>
                            <option value={1}>1 (¼)</option>
                            <option value={2}>2 (½)</option>
                            <option value={3}>3 (¾)</option>
                            <option value={4}>4 (1 stère)</option>
                          </select>
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Visiteurs (ne dorment pas) — 50€ / visiteur
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={draft.visitorsCount}
                            onChange={(e) => setDraft((d) => ({ ...d, visitorsCount: Number(e.target.value || 0) }))}
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
                            placeholder="0"
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Personnes en plus qui dorment — 50€ / personne / nuit
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={draft.extraSleepersCount}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, extraSleepersCount: Number(e.target.value || 0) }))
                            }
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
                            placeholder="0"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Nombre de nuits pour ces personnes
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, nights)}
                            value={draft.extraSleepersNights}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                extraSleepersNights: Number(e.target.value || 0),
                              }))
                            }
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
                            placeholder="0"
                          />
                          <span className="text-xs text-slate-500">
                            Max : {Math.max(0, nights)} nuit(s) (selon vos dates).
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">Message</span>
                    <textarea
                      required
                      value={draft.message}
                      onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                      placeholder="Dites-nous ce que vous recherchez…"
                      className="min-h-[140px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1f6fa3]/60 focus:ring-4 focus:ring-[#1f6fa3]/10"
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0b2a3a] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                    >
                      Envoyer ma demande
                    </button>

                    <Link
                      href={airbnbCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 whitespace-nowrap"
                    >
                      Voir les disponibilités sur Airbnb
                    </Link>
                  </div>

                  <p className="text-sm font-semibold text-red-600">
                    Le bouton Airbnb sert uniquement à consulter les disponibilités. Revenez ensuite ici
                    pour envoyer votre demande si vous souhaitez passer entre particuliers et éviter les frais.
                  </p>
                </form>
              </div>

              {/* Right panel */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="text-xs font-semibold tracking-widest text-slate-500">
                  RÉSUMÉ &amp; PRIX
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Aperçu en temps réel
                </div>
                <p className="mt-2 text-base text-slate-600">
                  Prix estimé (selon tarifs + options). Vérifiez avant l’envoi.
                </p>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-2 text-base text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">📅 Dates</span>
                      <span className="font-semibold text-slate-900">{datesLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">👥 Voyageurs</span>
                      <span className="font-semibold text-slate-900">{travelersLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">🐾 Animaux</span>
                      <span className="font-semibold text-slate-900">{animalLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Détails prix */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">Détail des prix</div>

                  <div className="mt-4 grid gap-3 text-base">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Base hébergement
                        {nights > 0 ? ` (${nights} nuit${nights > 1 ? "s" : ""})` : ""}
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.base)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Ménage (fixe)</span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.cleaningFee)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Animaux (10€/animal/nuit)
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.animalsCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Bois ({draft.woodQuarterSteres} x 1/4 stère)
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.woodCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Visiteurs ({draft.visitorsCount} x 50€)
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.visitorsCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Personnes en plus ({draft.extraSleepersCount} pers. x {pricing.extraNights} nuit{pricing.extraNights > 1 ? "s" : ""})
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.extraSleepersCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Arrivée début de journée</span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.earlyArrivalCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Départ fin de journée</span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.lateDepartureCost)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        Taxe de séjour (3,93€/adulte/nuit)
                      </span>
                      <span className="font-semibold text-slate-900">{formatEUR(pricing.touristTax)}</span>
                    </div>

                    <div className="my-2 h-px bg-slate-200" />

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-semibold text-slate-900">TOTAL estimé</span>
                      <span className="text-lg font-extrabold text-slate-900">{formatEUR(pricing.total)}</span>
                    </div>

                    {accommodation.nightly.length > 0 ? (
                      <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                          Voir le détail par nuit
                        </summary>
                        <div className="mt-3 grid gap-2 text-sm text-slate-700">
                          {accommodation.nightly.map((n, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3">
                              <span className="text-slate-600">
                                {n.date.toLocaleDateString("fr-FR", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </span>
                              <span className="font-semibold text-slate-900">{formatEUR(n.rate)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>

                <p className="mt-6 text-sm text-slate-500">
                  L’envoi se fait via votre application mail (mailto). Le prix affiché est une estimation basée
                  sur vos tarifs et les options sélectionnées.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-6 sm:px-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Consultez les disponibilités sur Airbnb, puis revenez ici pour envoyer votre demande en direct.
                </p>
                <Link
                  href={airbnbCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 whitespace-nowrap"
                >
                  Ouvrir Airbnb
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
