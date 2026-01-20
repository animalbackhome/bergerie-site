"use client";

import Image from "next/image";
import Link from "next/link";

type Props = {
  heroSrc: string;
  thumbSrcs: string[]; // expect 4 (we safeguard if missing)
  buttonHref?: string;
  buttonLabel?: string;
};

/**
 * Mosaic style (Airbnb-like):
 * - 1 grande image à gauche (2 colonnes x 2 lignes)
 * - 4 petites images carrées à droite
 * - bouton discret "Afficher toutes les photos"
 *
 * ⚠️ Ne crashe jamais si thumbSrcs est vide / incomplet.
 */
export default function PhotoMosaic({
  heroSrc,
  thumbSrcs,
  buttonHref = "/photos",
  buttonLabel = "Afficher toutes les photos",
}: Props) {
  const safeThumbs = Array.isArray(thumbSrcs)
    ? thumbSrcs.filter(Boolean).slice(0, 4)
    : [];

  while (safeThumbs.length < 4) safeThumbs.push(heroSrc);

  return (
    <section className="w-full">
      <div className="relative overflow-hidden rounded-3xl bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
        {/* 
          Grille 4 colonnes / 2 lignes :
          - la grande image prend 2 colonnes x 2 lignes (à gauche)
          - les 4 petites prennent 1 colonne x 1 ligne chacune (à droite)
          Astuce : un ratio 2:1 donne des petites cases quasi carrées (comme Airbnb).
        */}
        <div className="grid aspect-[4/3] w-full grid-cols-4 grid-rows-2 gap-2 p-2 sm:aspect-[2/1] sm:p-3">
          {/* Grande image */}
          <Link
            href={buttonHref}
            aria-label="Ouvrir la galerie photos"
            className="relative col-span-2 row-span-2 overflow-hidden rounded-2xl bg-white/10"
          >
            <Image
              src={heroSrc}
              alt="Photo principale"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 640px) 100vw, 1200px"
            />
          </Link>

          {/* 4 petites (carrées) */}
          {safeThumbs.map((src, idx) => (
            <Link
              key={`${src}-${idx}`}
              href={buttonHref}
              aria-label={`Ouvrir la galerie photos (photo ${idx + 2})`}
              className="relative overflow-hidden rounded-2xl bg-white/10"
            >
              <Image
                src={src}
                alt={`Photo ${idx + 2}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 400px"
              />
            </Link>
          ))}
        </div>

        {/* Bouton (plus discret, style Airbnb) */}
        <div className="pointer-events-none absolute bottom-4 right-4">
          <Link
            href={buttonHref}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <span className="grid h-4 w-4 place-items-center rounded-sm bg-slate-100 text-[10px] leading-none">
              ▦
            </span>
            {buttonLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
