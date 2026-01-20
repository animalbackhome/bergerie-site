"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LightboxGalleryProps = {
  images: string[];
  title?: string;
};

export default function LightboxGallery({ images, title }: LightboxGalleryProps) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const isOpen = openIndex !== null;
  const currentSrc = isOpen ? safeImages[openIndex] : "";

  const close = () => setOpenIndex(null);
  const prev = () =>
    setOpenIndex((i) =>
      i === null ? 0 : (i - 1 + safeImages.length) % safeImages.length,
    );
  const next = () =>
    setOpenIndex((i) => (i === null ? 0 : (i + 1) % safeImages.length));

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, safeImages.length]);

  return (
    <div className="w-full">
      {title ? (
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-white">
          {title}
        </h1>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {safeImages.map((src, idx) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15"
            aria-label={`Ouvrir la photo ${idx + 1}`}
          >
            <Image
              src={src}
              alt={`Photo ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Visionneuse de photos"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="relative w-full max-w-6xl">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black ring-1 ring-white/15">
              <Image
                src={currentSrc}
                alt="Photo en grand"
                fill
                priority
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={prev}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                ← Précédente
              </button>

              <div className="text-sm text-white/80">
                {openIndex! + 1} / {safeImages.length}
              </div>

              <button
                type="button"
                onClick={next}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Suivante →
              </button>
            </div>

            <button
              type="button"
              onClick={close}
              className="absolute -top-3 right-0 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-black/10 hover:bg-white"
              aria-label="Fermer"
            >
              Fermer ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
