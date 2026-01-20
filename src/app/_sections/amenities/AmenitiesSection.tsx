"use client";

import { useMemo, useState } from "react";

type AmenityItem = {
  label: string;
  note?: string; // ex: "Gratuit", "Toujours dans le logement", etc.
  icon?: string;
};

type AmenityCategory = {
  key: string;
  title: string;
  icon: string;
  items: AmenityItem[];
};

function Pill({ item }: { item: AmenityItem }) {
  return (
    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <span className="text-base">{item.icon ?? "✓"}</span>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{item.label}</div>
        {item.note ? (
          <div className="mt-0.5 text-xs text-slate-600">{item.note}</div>
        ) : null}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  query,
}: {
  category: AmenityCategory;
  query: string;
}) {
  const itemsSafe = Array.isArray(category?.items) ? category.items : [];

  const filtered = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return itemsSafe;
    return itemsSafe.filter((it) => {
      const hay = `${it.label} ${it.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, itemsSafe]);

  if (!filtered.length) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-xl ring-1 ring-slate-200">
            {category.icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              {category.title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              {filtered.length} élément{filtered.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Inclus
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((it, idx) => (
          <Pill key={`${category.key}-${idx}-${it.label}`} item={it} />
        ))}
      </div>
    </div>
  );
}

/**
 * ✅ Section Équipements (HOME)
 * - Bande pleine largeur BLANCHE
 * - Design pro : preview + mode "tout afficher"
 * - Recherche (filtre)
 * - Protection anti-crash : aucun .map() sur undefined
 */
export default function AmenitiesSection() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const categories = useMemo<AmenityCategory[]>(
    () => [
      {
        key: "bathroom",
        title: "Salle de bain",
        icon: "🛁",
        items: [
          { label: "2 sèche-cheveux", icon: "💨" },
          { label: "2 douches à l’italienne", icon: "🚿" },
          { label: "Machine à laver", icon: "🧺" },
          { label: "Produits de nettoyage", icon: "🧼" },
          { label: "Shampooing", icon: "🧴" },
          { label: "Savon pour le corps", icon: "🫧" },
          { label: "Gel douche", icon: "🫧" },
          { label: "Eau chaude", icon: "🔥" },
        ],
      },
      {
        key: "bed_linen",
        title: "Chambre et linge",
        icon: "🛏️",
        items: [
          {
            label: "Équipements de base",
            note: "Serviettes, draps, savon et papier toilette",
            icon: "✅",
          },
          { label: "Grand dressing", icon: "🧳" },
          { label: "Cintres", icon: "🧥" },
          { label: "Draps", icon: "🧻" },
          { label: "Couettes", icon: "🛌" },
          { label: "Couvertures supplémentaires", icon: "🛌" },
          { label: "4 oreillers par lit", icon: "🛏️" },
          { label: "Traversins", icon: "🛏️" },
          { label: "Tables de nuit", icon: "🛋️" },
          { label: "Lampes de chevet", icon: "💡" },
          { label: "Stores", icon: "🪟" },
          { label: "Fer à repasser", icon: "🧲" },
          { label: "Étendoir à linge", icon: "🧵" },
          { label: "Moustiquaire", icon: "🦟" },
          {
            label: "Espace de rangement vêtements",
            note: "Dressing, placard et armoire",
            icon: "🧳",
          },
        ],
      },
      {
        key: "entertainment",
        title: "Divertissement",
        icon: "🎬",
        items: [
          {
            label: "Connexion maxi vitesse par satellite via Starlink",
            icon: "🛰️",
          },
          { label: "Télévision (chaînes + Netflix + jeux vidéos)", icon: "📺" },
          { label: "Livres & de quoi lire", icon: "📚" },
          { label: "Jeux extérieurs / intérieurs pour enfants", icon: "🧩" },
          { label: "Terrain de boules", icon: "🎯" },
          { label: "Jeux aquatiques", icon: "💦" },
          { label: "Terrain de badminton", icon: "🏸" },
          { label: "Panier de basket", icon: "🏀" },
          { label: "Piscine", icon: "🏊" },
          {
            label: "Randonnées : lac, rivière, cascades, canal, forêt",
            icon: "🥾",
          },
          {
            label: "Jeux pour adultes : jeux de société, cartes, etc.",
            icon: "🃏",
          },
        ],
      },
      {
        key: "family",
        title: "Famille",
        icon: "👨‍👩‍👧‍👦",
        items: [
          {
            label: "Lit pour bébé",
            note: "Toujours dans le logement • Standard (1,3 m x 70 cm) • draps fournis",
            icon: "👶",
          },
          {
            label: "Lit parapluie",
            note: "Toujours dans le logement • draps fournis",
            icon: "🧸",
          },
          { label: "Livres & jouets pour enfants", icon: "🧩" },
          { label: "Chaise haute", icon: "🪑" },
          { label: "Pare-feu pour le poêle", icon: "🛡️" },
          {
            label: "Salle de jeux pour enfants",
            note: "Une salle avec des jouets, des livres et des jeux",
            icon: "🧸",
          },
          {
            label: "Aire de jeux extérieure",
            note: "Structures de jeux pour enfants",
            icon: "🛝",
          },
          { label: "Alarme de sécurité pour piscine", icon: "🚨" },
          { label: "Jeux aquatiques", icon: "💦" },
          { label: "Petit bassin avec carpes et grenouilles", icon: "🐟" },
        ],
      },
      {
        key: "heating",
        title: "Chauffage et climatisation",
        icon: "🔥",
        items: [
          { label: "Poêle à bois (en option)", icon: "🔥" },
          { label: "Ventilateurs portables", icon: "🌀" },
          { label: "Chauffage central", icon: "🌡️" },
        ],
      },
      {
        key: "safety",
        title: "Sécurité à la maison",
        icon: "🧯",
        items: [
          { label: "Détecteur de fumée", icon: "🚨" },
          { label: "Détecteur de monoxyde de carbone", icon: "⚠️" },
          { label: "Extincteur", icon: "🧯" },
          { label: "Kit de premiers secours", icon: "🩹" },
          { label: "Bâches anti-feu", icon: "🧯" },
        ],
      },
      {
        key: "kitchen",
        title: "Cuisine et salle à manger",
        icon: "🍽️",
        items: [
          {
            label: "Cuisine",
            note: "Espace où les voyageurs peuvent cuisiner",
            icon: "🍳",
          },
          { label: "Réfrigérateur", icon: "🧊" },
          { label: "Four à micro-ondes", icon: "📡" },
          { label: "Mini réfrigérateur (dans la chambre VIP)", icon: "🧊" },
          { label: "Congélateur", icon: "❄️" },
          { label: "Lave-vaisselle", icon: "🧼" },
          { label: "Cuisinière", icon: "🔥" },
          { label: "Four", icon: "♨️" },
          { label: "Bouilloire électrique", icon: "🫖" },
          { label: "Cafetière", icon: "☕" },
          { label: "Café", icon: "☕" },
          { label: "Verres à vin", icon: "🍷" },
          { label: "Grille-pain", icon: "🍞" },
          { label: "Plaque de cuisson", icon: "🍳" },
          {
            label: "Équipements de cuisine de base",
            note: "Casseroles & poêles, huile, sel et poivre",
            icon: "🧂",
          },
          {
            label: "Vaisselle & couverts",
            note: "Bols, assiettes, tasses, etc.",
            icon: "🍽️",
          },
          {
            label: "Ustensiles de barbecue",
            note: "Charbon, brochettes, etc.",
            icon: "🍖",
          },
          { label: "Table à manger", icon: "🪑" },
        ],
      },
      {
        key: "location",
        title: "Caractéristiques de l’emplacement",
        icon: "📍",
        items: [
          {
            label: "Accès au lac, rivière, cascades, canal, forêt",
            note: "Accès à pied via sentier / quai",
            icon: "🌊",
          },
          {
            label: "Entrée privée par piste en terre",
            note: "Arrivée par une piste en terre",
            icon: "🚪",
          },
          {
            label: "Laverie automatique à proximité (Intermarché)",
            icon: "🧺",
          },
        ],
      },
      {
        key: "outdoor",
        title: "Extérieur",
        icon: "🌿",
        items: [
          { label: "Patio ou balcon", icon: "🌤️" },
          {
            label: "Arrière-cour",
            note: "Espace ouvert généralement recouvert d’herbe",
            icon: "🌱",
          },
          { label: "Mobilier d’extérieur", icon: "🪑" },
          { label: "Espace repas en plein air", icon: "🍽️" },
          { label: "Barbecue", note: "Électrique", icon: "🔥" },
          { label: "Chaises longues", icon: "🧘" },
        ],
      },
      {
        key: "parking_pool",
        title: "Parking et installations",
        icon: "🚗",
        items: [
          { label: "Parking gratuit sur place", icon: "🅿️" },
          { label: "Piscine privée", icon: "🏊" },
        ],
      },
      {
        key: "services",
        title: "Services",
        icon: "🧾",
        items: [
          { label: "Animaux acceptés avec supplément", icon: "🐾" },
          { label: "Logement non fumeur", icon: "🚭" },
          {
            label: "Séjours longue durée autorisés",
            note: "28 jours ou plus",
            icon: "📅",
          },
          { label: "Clés remises par l’hôte", icon: "🔑" },
        ],
      },
    ],
    []
  );

  const categoriesSafe = Array.isArray(categories) ? categories : [];

  const flatAllItems = useMemo(() => {
    const all: (AmenityItem & { cat: string })[] = [];
    for (const c of categoriesSafe) {
      const items = Array.isArray(c.items) ? c.items : [];
      for (const it of items) all.push({ ...it, cat: c.title });
    }
    return all;
  }, [categoriesSafe]);

  const previewItems = useMemo(() => {
    // Un aperçu propre sur la home : 12 éléments max (quand fermé et sans recherche)
    return flatAllItems.slice(0, 12);
  }, [flatAllItems]);

  const hasQuery = (query ?? "").trim().length > 0;

  return (
    <section id="equipements" className="w-full bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold tracking-wide text-slate-700 ring-1 ring-slate-200">
              ÉQUIPEMENTS
            </div>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Ce que propose ce logement
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Les équipements listés ci-dessous sont disponibles sur place (selon
              l’organisation du logement).
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#0b2a3a] px-6 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:brightness-110"
            >
              {expanded ? "Réduire" : "Afficher tous les équipements"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un équipement (ex : lave-vaisselle, lit bébé, Wi-Fi…)…"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔎
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Astuce : tape un mot-clé pour filtrer instantanément.
          </div>
        </div>

        {/* Content */}
        {!expanded && !hasQuery ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewItems.map((it, idx) => (
                <Pill
                  key={`preview-${idx}-${it.label}`}
                  item={{
                    label: it.label,
                    note: it.note ? `${it.note} • ${it.cat}` : it.cat,
                    icon: it.icon,
                  }}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-700">
                Aperçu des équipements principaux. Clique sur{" "}
                <span className="font-semibold">“Afficher tous les équipements”</span>{" "}
                pour voir le détail par catégories.
              </p>

              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Tout afficher →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {categoriesSafe.map((cat) => (
              <CategoryCard key={cat.key} category={cat} query={query} />
            ))}

            {categoriesSafe.every((cat) => {
              const items = Array.isArray(cat.items) ? cat.items : [];
              const q = (query ?? "").trim().toLowerCase();
              if (!q) return false;
              return !items.some((it) =>
                `${it.label} ${it.note ?? ""}`.toLowerCase().includes(q)
              );
            }) ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
                Aucun résultat pour{" "}
                <span className="font-semibold">“{query.trim()}”</span>. Essaie
                un autre mot-clé.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
