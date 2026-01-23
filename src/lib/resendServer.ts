// src/lib/resendServer.ts
import { Resend } from "resend";

/**
 * Centralise les variables d'env + initialisation Resend.
 *
 * ⚠️ Important (Next.js / Vercel)
 * - Ne JAMAIS throw au chargement du module si une env manque,
 *   sinon tu peux casser le build / preview.
 * - On préfère : warnings + "resend" initialisé seulement si la clé existe.
 *   Les routes API qui en ont besoin doivent avoir les envs en prod.
 */

function envOrNull(name: string) {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function envNumberOrNull(name: string) {
  const v = envOrNull(name);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** -------------------------
 * Resend client (lazy safe)
 * ------------------------ */
const apiKey = envOrNull("RESEND_API_KEY");

// Export conservé (pour compat) : si la clé n'est pas là, resend sera null.
// Les routes qui appellent resend.emails.send doivent tourner avec RESEND_API_KEY présent.
export const resend: Resend | null = apiKey ? new Resend(apiKey) : null;

if (!apiKey) {
  console.warn("Missing RESEND_API_KEY (emails disabled)");
}

// Expéditeur par défaut (doit être un sender valide côté Resend)
export const RESEND_FROM = envOrNull("RESEND_FROM") || "onboarding@resend.dev";

// Base URL du site (pour générer les liens dans les emails)
export const SITE_URL = envOrNull("SITE_URL") || "http://localhost:3000";

/**
 * =========================
 * REVIEWS (avis) — EXISTANT
 * =========================
 */
export const REVIEWS_NOTIFY_EMAIL = envOrNull("REVIEWS_NOTIFY_EMAIL");

// Secret pour signer les liens “Valider / Refuser” (HMAC) des avis
export const REVIEWS_MODERATION_SECRET = envOrNull("REVIEWS_MODERATION_SECRET");

if (!REVIEWS_NOTIFY_EMAIL) {
  console.warn("Missing REVIEWS_NOTIFY_EMAIL (emails disabled)");
}
if (!REVIEWS_MODERATION_SECRET) {
  console.warn("Missing REVIEWS_MODERATION_SECRET (moderation links disabled)");
}

/**
 * =====================================
 * BOOKING REQUEST (réservations) — AJOUT
 * =====================================
 */

// Nom "marketing" de la propriété (utilisé dans les emails)
export const BOOKING_PROPERTY_NAME =
  envOrNull("BOOKING_PROPERTY_NAME") || "Superbe bergerie en cœur de forêt – piscine & lac";

// Email admin qui reçoit les demandes de réservation (toi)
export const BOOKING_NOTIFY_EMAIL = envOrNull("BOOKING_NOTIFY_EMAIL");

// Optionnel : adresse qui recevra les réponses (Reply-To)
export const BOOKING_REPLY_TO = envOrNull("BOOKING_REPLY_TO");

// Secret HMAC pour signer les liens “Accepter / Refuser / Répondre”
export const BOOKING_MODERATION_SECRET = envOrNull("BOOKING_MODERATION_SECRET");

/**
 * Tarification côté serveur (ANTI-TRICHE)
 * Utilisable dans /api/booking-request (et donc dans le contrat),
 * au lieu de faire confiance aux montants envoyés par le navigateur.
 */
export const BOOKING_BASE_PRICE_PER_NIGHT =
  envNumberOrNull("BOOKING_BASE_PRICE_PER_NIGHT") ??
  envNumberOrNull("BASE_PRICE_PER_NIGHT") ??
  null;

export const BOOKING_TOURIST_TAX_PER_ADULT_NIGHT =
  envNumberOrNull("BOOKING_TOURIST_TAX_PER_ADULT_NIGHT") ?? 3.93;

export const BOOKING_CLEANING_FEE_FIXED =
  envNumberOrNull("BOOKING_CLEANING_FEE_FIXED") ?? 100;

export const BOOKING_ANIMAL_FEE_PER_NIGHT =
  envNumberOrNull("BOOKING_ANIMAL_FEE_PER_NIGHT") ?? 10;

export const BOOKING_WOOD_PRICE_PER_QUARTER_STERE =
  envNumberOrNull("BOOKING_WOOD_PRICE_PER_QUARTER_STERE") ?? 40;

export const BOOKING_VISITOR_FEE_PER_PERSON =
  envNumberOrNull("BOOKING_VISITOR_FEE_PER_PERSON") ?? 50;

export const BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT =
  envNumberOrNull("BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT") ?? 50;

export const BOOKING_EARLY_ARRIVAL_FEE =
  envNumberOrNull("BOOKING_EARLY_ARRIVAL_FEE") ?? 70;

export const BOOKING_LATE_DEPARTURE_FEE =
  envNumberOrNull("BOOKING_LATE_DEPARTURE_FEE") ?? 70;

if (!BOOKING_NOTIFY_EMAIL) {
  console.warn("Missing BOOKING_NOTIFY_EMAIL (booking emails disabled)");
}
if (!BOOKING_MODERATION_SECRET) {
  console.warn("Missing BOOKING_MODERATION_SECRET (booking moderation links disabled)");
}
if (BOOKING_BASE_PRICE_PER_NIGHT == null) {
  console.warn(
    "Missing BOOKING_BASE_PRICE_PER_NIGHT (or BASE_PRICE_PER_NIGHT). Pricing anti-triche will not be fully server-driven."
  );
}

/**
 * Petit helper optionnel (si tu veux sécuriser l'appel)
 * Exemple usage :
 *   const r = requireResend();
 *   await r.emails.send(...)
 */
export function requireResend() {
  if (!resend) throw new Error("Resend disabled (missing RESEND_API_KEY).");
  return resend;
}
