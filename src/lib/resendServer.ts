// src/lib/resendServer.ts
import { Resend } from "resend";

/**
 * Même logique :
 * - Si on exporte `resend: Resend | null`, le build plante : "resend is possibly 'null'".
 * ➜ On exporte une instance toujours typée Resend, et on fournit `requireResend()`
 *   pour une erreur claire si la clé manque.
 */

function envStr(name: string) {
  const v = process.env[name];
  return v ? String(v).trim() : "";
}

function envNum(name: string): number | null {
  const s = envStr(name);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const RESEND_API_KEY =
  envStr("RESEND_API_KEY") || envStr("RESEND_APIKEY") || envStr("RESEND_KEY");

export const resend = new Resend(RESEND_API_KEY || "MISSING_RESEND_API_KEY");

export function requireResend(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      "Missing RESEND_API_KEY. Ajoute-la dans Vercel > Environment Variables puis redeploy."
    );
  }
  return new Resend(RESEND_API_KEY);
}

/** Expéditeur par défaut (obligatoire chez Resend) */
export const RESEND_FROM =
  envStr("RESEND_FROM") || envStr("BOOKING_RESEND_FROM") || "onboarding@resend.dev";

/** URL du site (pour générer des liens absolus dans les emails) */
export const SITE_URL =
  envStr("SITE_URL") || envStr("NEXT_PUBLIC_SITE_URL") || envStr("VERCEL_URL") || "";

/** Emails Booking */
export const BOOKING_NOTIFY_EMAIL = envStr("BOOKING_NOTIFY_EMAIL");
export const BOOKING_REPLY_TO = envStr("BOOKING_REPLY_TO");
export const BOOKING_MODERATION_SECRET = envStr("BOOKING_MODERATION_SECRET");

/** Pricing (tous en EUR) */
export const BOOKING_BASE_PRICE_PER_NIGHT = envNum("BOOKING_BASE_PRICE_PER_NIGHT");
export const BOOKING_TOURIST_TAX_PER_ADULT_NIGHT = envNum("BOOKING_TOURIST_TAX_PER_ADULT_NIGHT");
export const BOOKING_CLEANING_FEE_FIXED = envNum("BOOKING_CLEANING_FEE_FIXED");
export const BOOKING_ANIMAL_FEE_PER_NIGHT = envNum("BOOKING_ANIMAL_FEE_PER_NIGHT");
export const BOOKING_WOOD_PRICE_PER_QUARTER_STERE = envNum("BOOKING_WOOD_PRICE_PER_QUARTER_STERE");
export const BOOKING_VISITOR_FEE_PER_PERSON = envNum("BOOKING_VISITOR_FEE_PER_PERSON");
export const BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT = envNum("BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT");
export const BOOKING_EARLY_ARRIVAL_FEE = envNum("BOOKING_EARLY_ARRIVAL_FEE");
export const BOOKING_LATE_DEPARTURE_FEE = envNum("BOOKING_LATE_DEPARTURE_FEE");
