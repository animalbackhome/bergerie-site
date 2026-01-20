import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) throw new Error("Missing RESEND_API_KEY");

export const resend = new Resend(apiKey);

export const RESEND_FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
export const REVIEWS_NOTIFY_EMAIL = process.env.REVIEWS_NOTIFY_EMAIL;

// Base URL du site (pour générer les liens dans les emails)
export const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

// Secret pour signer les liens “Valider / Refuser” (HMAC)
export const REVIEWS_MODERATION_SECRET = process.env.REVIEWS_MODERATION_SECRET;

if (!REVIEWS_NOTIFY_EMAIL) {
  console.warn("Missing REVIEWS_NOTIFY_EMAIL (emails disabled)");
}
if (!REVIEWS_MODERATION_SECRET) {
  console.warn("Missing REVIEWS_MODERATION_SECRET (moderation links disabled)");
}
