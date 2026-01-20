import PhotoMosaic from "../../_components/PhotoMosaic";

type Props = {
  title: string;
  summaryLine: string;
  images: string[]; // ideally 5 images
  buttonHref?: string;
  buttonLabel?: string;
};

export default function HeroSection({
  title,
  summaryLine,
  images,
  buttonHref = "/photos",
  buttonLabel = "Afficher toutes les photos",
}: Props) {
  const heroSrc = images?.[0] ?? "/images/bergerie/hero-1.jpg";
  const thumbSrcs = Array.isArray(images) ? images.slice(1, 5) : [];

  return (
    <section className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#0a2a3c] to-[#051a2b]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>

        <p className="mt-5 text-center text-sm text-white/85 sm:text-base">
          {summaryLine}
        </p>

        <div className="mt-10">
          <PhotoMosaic
            heroSrc={heroSrc}
            thumbSrcs={thumbSrcs}
            buttonHref={buttonHref}
            buttonLabel={buttonLabel}
          />
        </div>
      </div>
    </section>
  );
}
