"use client";

import { useMemo } from "react";
import PaiementSection from "./_sections/paiement";
import PhotoMosaic from "./_components/PhotoMosaic";

// ✅ Sections
import InfoSection from "./_sections/info/InfoSection";
import ReviewsSection from "./_sections/reviews/ReviewsSection";
import AmenitiesSection from "./_sections/amenities/AmenitiesSection";
import ContactSection from "./_sections/contact/ContactSection";

// ✅ TOURISME (⚠️ IMPORTANT : import via index.ts du dossier /tourism)
import TourismSection from "./_sections/tourism";
import type { TourismItem } from "./_sections/types";

export default function HomePage() {
  const HERO_IMAGES = useMemo(
    () => [
      "/images/bergerie/hero-01.jpg",
      "/images/bergerie/gallery-01.jpg",
      "/images/bergerie/gallery-02.jpg",
      "/images/bergerie/gallery-03.jpg",
      "/images/bergerie/gallery-04.jpg",
    ],
    []
  );

  const summaryLine =
    "Location saisonnière ENTRE PARTICULIERS • Logement entier • 8 voyageurs • 3 chambres • 2 salles de bain • Piscine privée • Accès lac";

  const tourisme: TourismItem[] = useMemo(
    () => [
      {
        title:
          "Office de Tourisme de Cotignac | Provence Verte & Verdon Tourisme",
        description:
          "Cotignac et son rocher situé à 10 minutes de Carcès. Village au charme provençal, ruelles et calades fleuries, panorama superbe et ambiance authentique.",
        imageSrcs: [
          "/images/tourisme/cotignac-1.jpg",
          "/images/tourisme/cotignac-2.jpg",
          "/images/tourisme/cotignac-3.jpg",
        ],
        recommendedByLocals: 46,
      },
      {
        title: "Rocher et grottes troglodytes de Cotignac",
        description:
          "Site emblématique : grottes, habitations troglodytes, et point de vue magnifique sur le village. Visite selon horaires (fermetures possibles).",
        imageSrcs: [
          "/images/tourisme/grottes-1.jpg",
          "/images/tourisme/grottes-2.jpg",
          "/images/tourisme/grottes-3.jpg",
        ],
      },
      {
        title: "Sanctuaire Notre-Dame-de-Grâces de Cotignac",
        description:
          "Lieu remarquable, simple et apaisant, dans un cadre de nature. Idéal pour une balade et un moment de calme.",
        imageSrcs: [
          "/images/tourisme/sanctuaire-1.jpg",
          "/images/tourisme/sanctuaire-2.jpg",
          "/images/tourisme/sanctuaire-3.jpg",
        ],
        recommendedByLocals: 12,
      },
      {
        title: "Monastère Saint-Joseph du Bessillon",
        description:
          "Monastère situé à Cotignac au pied du Bessillon. Balade agréable et découverte d’un lieu chargé d’histoire.",
        imageSrcs: [
          "/images/tourisme/monastere-1.jpg",
          "/images/tourisme/monastere-2.jpg",
          "/images/tourisme/monastere-3.jpg",
        ],
        recommendedByLocals: 7,
      },
      {
        title: "Cascade Cassole / Gouffre – Vallon Gaï",
        description:
          "Magnifique balade nature avec des coins d’eau très frais. Accessible à pied selon l’itinéraire choisi (infos variables selon saison).",
        imageSrcs: [
          "/images/tourisme/cassole-1.jpg",
          "/images/tourisme/cassole-2.jpg",
          "/images/tourisme/cassole-3.jpg",
        ],
        recommendedByLocals: 8,
      },
      {
        title: "Chutes du Caramy",
        description:
          "Randonnée facile et très jolie avec plusieurs points d’eau. Parfait pour une sortie en famille, surtout en été.",
        imageSrcs: [
          "/images/tourisme/caramy-1.jpg",
          "/images/tourisme/caramy-2.jpg",
          "/images/tourisme/caramy-3.jpg",
        ],
        recommendedByLocals: 15,
      },
      {
        title: "Le lac de Carcès",
        description:
          "Promenade au bord du lac (100 ha) : paysages superbes, coins pique-nique et nature partout. Très agréable tôt le matin ou au coucher du soleil.",
        imageSrcs: ["/images/tourisme/lac-carces-1.jpg"],
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#0a2a3c] to-[#051a2b]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-left text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Superbe bergerie en cœur de forêt &amp; piscine – accès direct lac /
            rivière / cascades
          </h1>

          <p className="mt-5 text-left text-sm text-white/85 sm:text-base">
            {summaryLine}
          </p>

          <div className="mt-10">
            <PhotoMosaic
              heroSrc={HERO_IMAGES[0]}
              thumbSrcs={HERO_IMAGES.slice(1, 5)}
              buttonHref="/photos"
              buttonLabel="Afficher toutes les photos"
            />
          </div>
        </div>
      </section>

      <ReviewsSection />
      <InfoSection />
      <AmenitiesSection />

      {/* ✅ TOURISME (unique point d’entrée) */}
      <TourismSection items={tourisme} />

      <PaiementSection />
      <ContactSection />
    </main>
  );
}
