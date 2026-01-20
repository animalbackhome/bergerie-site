import LightboxGallery from "../_components/LightboxGallery";

const GALLERY_COUNT = 77;

const IMAGES = [
  "/images/bergerie/hero-01.jpg",
  ...Array.from({ length: GALLERY_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `/images/bergerie/gallery-${n}.jpg`;
  }),
];

export default function PhotosPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-950 via-sky-950 to-slate-950 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <LightboxGallery images={IMAGES} title="Toutes les photos" />
      </div>
    </main>
  );
}
