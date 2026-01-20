"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

export type Review = {
  name: string;
  dateLabel: string;
  text: string;
  rating?: number;
};

type Props = {
  id?: string;
  titleKicker?: string;
  title?: string;
  subtitle?: string;
  airbnbUrl?: string;
  reviews?: Review[];
};

export default function ReviewsSection({
  id = "avis",
  titleKicker = "AVIS",
  title = "Avis de voyageurs",
  subtitle,
  airbnbUrl = "https://www.airbnb.com",
  reviews,
}: Props) {
  const items = useMemo<Review[]>(
    () =>
      reviews?.length
        ? reviews
        : [
            {
              name: "Rémi",
              dateLabel: "juillet 2025",
              text: "Super séjour. Lieu très dépaysant, au calme, avec une piscine incroyable. Nous avons adoré la terrasse et l’ambiance nature.",
              rating: 5,
            },
            {
              name: "Aurélia Pascale D",
              dateLabel: "septembre 2025",
              text: "Maison magnifique, très spacieuse, et parfaitement équipée. Le cadre est vraiment exceptionnel, on se sent seuls au monde.",
              rating: 5,
            },
            {
              name: "Gregory",
              dateLabel: "août 2025",
              text: "Merci pour cette déconnexion ! Nous avons adoré notre séjour dans votre “petit coin de paradis”. Tout était parfait.",
              rating: 5,
            },
          ],
    [reviews]
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollByCards = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-review-card]");
    const cardWidth = card?.offsetWidth ?? 360;
    const gap = 16;
    const amount = (cardWidth + gap) * 1.25 * (dir === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const stars = (n?: number) => {
    const count = Math.max(1, Math.min(5, Math.round(n ?? 5)));
    return "★★★★★".slice(0, count) + "☆☆☆☆☆".slice(0, 5 - count);
  };

  return (
    <section className="w-full bg-white" id={id}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 ring-1 ring-slate-200">
            {titleKicker}
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <div className="relative">
            <button
              type="button"
              aria-label="Avis précédents"
              onClick={() => scrollByCards("left")}
              className="hidden sm:grid absolute -left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Avis suivants"
              onClick={() => scrollByCards("right")}
              className="hidden sm:grid absolute -right-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              ›
            </button>

            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="region"
              aria-label="Avis de voyageurs"
            >
              {items.map((r, idx) => (
                <article
                  key={`${r.name}-${r.dateLabel}-${idx}`}
                  data-review-card
                  className="min-w-[300px] max-w-[360px] flex-1 snap-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {r.name}
                      </div>
                      <div className="text-xs text-slate-500">{r.dateLabel}</div>
                    </div>

                    <div
                      className="text-sm text-yellow-500"
                      aria-label={`${r.rating ?? 5} étoiles`}
                      title={`${r.rating ?? 5} étoiles`}
                    >
                      {stars(r.rating)}
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-700">
                    {r.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={airbnbUrl}
            target="_blank"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Découvrir tous nos avis sur Airbnb
          </Link>

          <button
            type="button"
            onClick={() => {
              setSubmitOk(null);
              setSubmitErr(null);
              setIsFormOpen((v) => !v);
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#0b2a3a] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Laisser un avis, réservé aux voyageurs
          </button>
        </div>

        {isFormOpen ? (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">
              Déposer un avis (réservé aux voyageurs)
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Merci d’indiquer votre nom, votre email et votre message. Votre avis
              sera enregistré et publié uniquement après validation.
            </p>

            {submitOk ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {submitOk}
              </div>
            ) : null}

            {submitErr ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {submitErr}
              </div>
            ) : null}

            <form
              className="mt-6 grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSubmitting) return;

                setSubmitOk(null);
                setSubmitErr(null);

                const form = e.currentTarget;
                const fd = new FormData(form);
                const name = String(fd.get("name") || "").trim();
                const email = String(fd.get("email") || "").trim();
                const message = String(fd.get("message") || "").trim();

                if (!name || !email || !message) {
                  setSubmitErr("Merci de remplir tous les champs.");
                  return;
                }

                setIsSubmitting(true);
                try {
                  const res = await fetch("/api/reviews", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, message, rating: 5 }),
                  });

                  const json = await res.json().catch(() => null);

                  if (!res.ok || !json?.ok) {
                    setSubmitErr(
                      json?.error || "Une erreur est survenue. Merci de réessayer."
                    );
                    return;
                  }

                  setSubmitOk(
                    "Merci ! Votre avis a bien été envoyé et est en attente de validation."
                  );
                  form.reset();
                } catch {
                  setSubmitErr(
                    "Impossible d’envoyer l’avis (connexion). Merci de réessayer."
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-900">Nom</span>
                  <input
                    name="name"
                    required
                    placeholder="Votre nom"
                    className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-0 focus:border-slate-300"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Email
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="vous@email.com"
                    className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-0 focus:border-slate-300"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  Votre avis
                </span>
                <textarea
                  name="message"
                  required
                  placeholder="Votre message…"
                  className="min-h-[160px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-300"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Fermer
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0b2a3a] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Envoi..." : "Envoyer mon avis"}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                En cliquant sur « Envoyer mon avis », votre avis est envoyé au site
                (aucune ouverture de messagerie).
              </p>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
