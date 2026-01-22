// src/lib/resendServer.ts
import { Resend } from "resend";

function envOrNull(name: string) {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

const apiKey = envOrNull("RESEND_API_KEY");
if (!apiKey) throw new Error("Missing RESEND_API_KEY");

export const resend = new Resend(apiKey);

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

// Email admin qui reçoit les demandes de réservation (toi)
export const BOOKING_NOTIFY_EMAIL = envOrNull("BOOKING_NOTIFY_EMAIL");

// Optionnel : adresse qui recevra les réponses (Reply-To) quand tu réponds au client
export const BOOKING_REPLY_TO = envOrNull("BOOKING_REPLY_TO");

// Secret HMAC pour signer les liens “Accepter / Refuser / Répondre”
export const BOOKING_MODERATION_SECRET = envOrNull("BOOKING_MODERATION_SECRET");

if (!BOOKING_NOTIFY_EMAIL) {
  console.warn("Missing BOOKING_NOTIFY_EMAIL (booking emails disabled)");
}
if (!BOOKING_MODERATION_SECRET) {
  console.warn("Missing BOOKING_MODERATION_SECRET (booking moderation links disabled)");
}
