"use client";

import { useMemo, useState, type ReactNode } from "react";

type Block = {
  title: string;
  icon: string;
  items: { icon: string; text: string }[];
};

function Callout({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_-20%,rgba(31,111,163,0.10),transparent_55%),radial-gradient(700px_circle_at_110%_0%,rgba(11,42,58,0.10),transparent_55%)]" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
          <span className="text-xl">{icon}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">À lire avant réservation</p>
        </div>
      </div>
      <div className="relative mt-5 text-base leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}

function AccordionCard({
  block,
  defaultOpen = false,
}: {
  block: Block;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const previewCount = 3;
  const hasMore = block.items.length > previewCount;
  const previewItems = block.items.slice(0, previewCount);

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        "transition hover:shadow-md hover:-translate-y-[1px]",
      ].join(" ")}
    >
      {/* halo doux */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(700px_circle_at_20%_0%,rgba(31,111,163,0.12),transparent_55%)]" />

      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full text-left"
      >
        <div className="flex items-start gap-3 p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
            <span className="text-xl">{block.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {block.title}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {block.items.length} point{block.items.length > 1 ? "s" : ""} • Cliquez pour{" "}
                  {open ? "réduire" : "dérouler"}
                </p>
              </div>

              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  "bg-white ring-1 ring-slate-200 shadow-sm",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-slate-700 transition-transform duration-300",
                    open ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  ˅
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* divider animé */}
        <div className="h-px w-full bg-slate-200/70" />
      </button>

      {/* Preview (toujours visible) */}
      <div className="relative px-6 py-5">
        <ul className="space-y-3">
          {(open ? block.items : previewItems).map((it, idx) => (
            <li
              key={`${block.title}-${idx}`}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
                <span className="text-base">{it.icon}</span>
              </div>
              <p className="text-base leading-relaxed text-slate-700">
                {it.text}
              </p>
            </li>
          ))}
        </ul>

        {/* CTA compact */}
        {hasMore && !open ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              + {block.items.length - previewCount} info supplémentaire
              {block.items.length - previewCount > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center rounded-full bg-[#0b2a3a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Voir plus
            </button>
          </div>
        ) : null}

        {open ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Réduire
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InfoSection() {
  const [tab, setTab] = useState<"description" | "reglement">("description");
  const [animKey, setAnimKey] = useState(0);

  const descriptionBlocks: Block[] = useMemo(
    () => [
      {
        title: "Cadre & localisation",
        icon: "🌿",
        items: [
          {
            icon: "🌿",
            text: "Bergerie provençale en pierres nichée en pleine forêt, pour un séjour au calme absolu dans le Var.",
          },
          {
            icon: "📍",
            text: "À Carcès (Provence), à 10 minutes du village et de ses commerces (restaurants, pharmacie, supermarché...).",
          },
          {
            icon: "🏞️",
            text: "À environ 5 minutes à pied du lac de Carcès, des cascades et de la rivière, idéal pour les amoureux de plein air.",
          },
          {
            icon: "💧",
            text: "Proche des cascades du Caramy : baignades nature, balades, fraîcheur en été et paysages superbes.",
          },
          {
            icon: "🌳",
            text: "Terrain arboré de 3 750 m² : pins, chênes, oliviers et essences provençales, sans vis-à-vis.",
          },
          {
            icon: "✨",
            text: "Nuits incroyables : ciel étoilé, silence, ambiance “seul au monde” au cœur de la nature.",
          },
          {
            icon: "🦌",
            text: "Rencontres possibles : biches, chevreuils, renards (la forêt méditerranéenne est tout autour).",
          },
          {
            icon: "🚗",
            text: "Accès par piste forestière : arrivée dépaysante, immersion totale dès les premières minutes.",
          },
        ],
      },
      {
        title: "Le logement",
        icon: "🏡",
        items: [
          {
            icon: "👨‍👩‍👧‍👦",
            text: "Une villa spacieuse et conviviale (215 m²) pensée pour partager des moments en famille ou entre amis.",
          },
          {
            icon: "🍽️",
            text: "Cuisine équipée avec bar ouverte sur une terrasse d’environ 40 m², côté piscine et forêt.",
          },
          {
            icon: "🌤️",
            text: "Grande véranda lumineuse avec grandes tables, parfaite pour les repas “dedans-dehors”.",
          },
          {
            icon: "🔥",
            text: "Salon cosy avec poêle à bois, TV et coin bar (ambiance chaleureuse le soir).",
          },
          {
            icon: "🛏️",
            text: "Chambre XXL (≈35 m²) avec deux lits doubles, dressing, décoration apaisante.",
          },
          {
            icon: "🧸",
            text: "Chambre familiale avec lit double, lit bébé, jeux, livres, espace enfant (pratique et rassurant).",
          },
          {
            icon: "🚿",
            text: "Salle de bains avec grande douche à l’italienne, double vasque, rangements, serviettes fournies.",
          },
          {
            icon: "🚻",
            text: "WC séparé avec lave-mains pour plus de confort.",
          },
        ],
      },
      {
        title: "Suite indépendante",
        icon: "🛌",
        items: [
          {
            icon: "🛌",
            text: "Suite indépendante (≈35 m²) avec accès direct piscine : lit king-size, douche à l’italienne, WC, petit frigo.",
          },
          { icon: "⚽", text: "Baby-foot à disposition dans la suite (bonus très apprécié)." },
        ],
      },
      {
        title: "Extérieurs & équipements",
        icon: "🏝️",
        items: [
          {
            icon: "🌀",
            text: "Piscine au sel (Diffazur) : transats, bouées et jeux, pour des journées 100% détente.",
          },
          { icon: "🎾", text: "Terrain de badminton." },
          { icon: "🏀", text: "Panier de basket." },
          { icon: "🎯", text: "Terrain de boules pour l’esprit “vacances en Provence”." },
          { icon: "🛝", text: "Jeux pour enfants." },
          {
            icon: "🌴",
            text: "Espace repas ombragé sous un grand arbre, idéal pour les déjeuners d’été.",
          },
          { icon: "🚗", text: "Grand parking gratuit + abri voiture sur la propriété." },
          {
            icon: "🥾",
            text: "Départ de balades direct : forêt, lac, cascades, randonnées accessibles rapidement.",
          },
        ],
      },
      {
        title: "Petite touche unique",
        icon: "🌟",
        items: [
          {
            icon: "🧑‍🌾",
            text: "Maison de gardien à env. 50 m : présence rassurante et aide possible en cas de besoin.",
          },
        ],
      },
    ],
    []
  );

  const reglementBlocks: Block[] = useMemo(
    () => [
      {
        title: "Arrivée / Départ",
        icon: "🕒",
        items: [
          { icon: "🕒", text: "Arrivée : à partir de 16h00." },
          { icon: "🕚", text: "Départ : avant 11h00." },
          {
            icon: "🧾",
            text: "Option arrivée plus tôt ou départ plus tard : 70 € (si nous n’avons pas d’autre réservation).",
          },
        ],
      },
      {
        title: "Caution & paiement",
        icon: "💳",
        items: [
          { icon: "💶", text: "Caution : 500 € à remettre à l’arrivée (chèques non acceptés)." },
          { icon: "🏦", text: "Paiement : par virement bancaire uniquement." },
        ],
      },
      {
        title: "Respect du lieu",
        icon: "🏡",
        items: [
          { icon: "🚭", text: "Maison non-fumeur (possible en extérieur uniquement)." },
          { icon: "🎉", text: "Fêtes et enterrements de vie de jeune fille / garçon non acceptés." },
          {
            icon: "👥",
            text: "Nombre de voyageurs : 8 personnes et plus sur demande avec supplément (pas de visiteurs extérieurs sans accord).",
          },
        ],
      },
      {
        title: "Piscine",
        icon: "🏊‍♀️",
        items: [
          {
            icon: "👶",
            text: "Enfants sous surveillance obligatoire (piscine non clôturée avec alarme de sécurité).",
          },
          { icon: "⛔", text: "Interdit de plonger (profondeur variable)." },
          { icon: "🧴", text: "Merci de se rincer avant baignade (crème/huile)." },
        ],
      },
      {
        title: "Animaux",
        icon: "🐾",
        items: [
          {
            icon: "🐾",
            text: "Animaux acceptés uniquement sur demande (à préciser avant réservation), sans limite de nombre et avec supplément.",
          },
          {
            icon: "🧼",
            text: "Merci de ramasser les excréments et de respecter l’intérieur (poils / boue / griffes sur canapé/lits...).",
          },
        ],
      },
      {
        title: "Ménage",
        icon: "🧹",
        items: [
          { icon: "🧽", text: "Ménage : la maison doit être rendue “correcte” (vaisselle, poubelles, etc.)." },
          {
            icon: "🧺",
            text: "Linge : serviettes fournies, merci de ne pas les utiliser pour l’extérieur/piscine.",
          },
        ],
      },
    ],
    []
  );

  const blocks = tab === "description" ? descriptionBlocks : reglementBlocks;

  return (
    <section
      id="infos"
      data-component="InfoSection-v4-accordion"
      className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#082739] to-[#051a2b]"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-[32px] border-2 border-[#1f6fa3]/70 bg-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/15 backdrop-blur-xl">
          {/* Header */}
          <div className="relative px-6 py-8 sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_15%_-10%,rgba(31,111,163,0.35),transparent_55%),radial-gradient(700px_circle_at_110%_0%,rgba(255,255,255,0.10),transparent_55%)]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-widest text-white/90">
                  INFORMATIONS
                </span>

                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Informations
                </h2>

                <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/75">
                  Tout ce qu’il faut pour réserver sereinement : description complète,
                  équipements, accès, et règles de la maison.
                </p>
              </div>

              {/* Tabs */}
              <div className="inline-flex w-full rounded-2xl bg-white/10 p-1 ring-1 ring-white/15 sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setTab("description");
                    setAnimKey((k) => k + 1);
                  }}
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-base font-semibold transition sm:flex-none",
                    tab === "description"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/85 hover:text-white",
                  ].join(" ")}
                >
                  Description
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("reglement");
                    setAnimKey((k) => k + 1);
                  }}
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-base font-semibold transition sm:flex-none",
                    tab === "reglement"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/85 hover:text-white",
                  ].join(" ")}
                >
                  Règlement
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-8 sm:px-10 sm:py-10">
            {tab === "description" ? (
              <Callout title="En résumé" icon="⭐">
                Bergerie provençale en pleine nature, grand confort, piscine au sel,
                accès rapide lac/cascades, et espaces pensés pour les familles comme
                pour les séjours entre amis.
              </Callout>
            ) : (
              <Callout title="Important" icon="⚠️">
                Merci de respecter ces règles : elles protègent le lieu, la sécurité
                (notamment piscine), et garantissent un séjour agréable pour tous.
              </Callout>
            )}

            {/* Animation fade/slide à chaque switch */}
            <div
              key={animKey}
              className="mt-6 animate-[fadeInUp_320ms_ease-out]"
            >
              <div className="grid gap-6 lg:grid-cols-2">
                {blocks.map((b, idx) => (
                  <div
                    key={b.title}
                    className="animate-[fadeInUp_420ms_ease-out] [animation-delay:var(--d)]"
                    style={{ ["--d" as any]: `${idx * 60}ms` }}
                  >
                    <AccordionCard block={b} />
                  </div>
                ))}
              </div>

              {tab === "reglement" ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Questions ?</h3>
                  <p className="mt-1 text-base text-slate-700">
                    Si un point du règlement n’est pas clair, écrivez-nous avant réservation :
                    on préfère valider ensemble plutôt que d’avoir une surprise sur place.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Keyframes Tailwind */}
            <style jsx>{`
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}
