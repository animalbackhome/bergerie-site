// src/app/_sections/index.ts

export { default as HeroSection } from "./hero/HeroSection";
export { default as ReviewsSection } from "./reviews/ReviewsSection";
export { default as InfoSection } from "./info/InfoSection";
export { default as AmenitiesSection } from "./amenities/AmenitiesSection";
export { default as TourismSection } from "./tourism/TourismSection";

// ✅ FIX: dossier = "paiement" (pas "payment")
export { default as PaymentSection } from "./paiement/PaiementSection";

export { default as ContactSection } from "./contact/ContactSection";

// ✅ FIX: évite d’exporter des types qui n’existent pas (ex: Review)
// On ré-exporte tout ce qui est défini dans ./types
export * from "./types";
