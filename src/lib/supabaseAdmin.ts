// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin (Service Role) — SERVER ONLY
 *
 * ⚠️ Ne JAMAIS utiliser cette clé côté client.
 * Ce module est fait pour être importé uniquement dans des routes server
 * (src/app/api/**), pas dans des composants "use client".
 *
 * Pourquoi on n'utilise PAS NEXT_PUBLIC_* ici :
 * - On privilégie SUPABASE_URL côté serveur (stable sur Vercel)
 * - NEXT_PUBLIC_SUPABASE_URL reste OK en fallback si tu n'as que ça.
 *
 * Pourquoi on ne throw pas au chargement :
 * - Pour éviter de casser le build si une env manque en Preview/Dev.
 *   Les routes qui utilisent supabaseAdmin doivent exiger les envs
 *   au moment de l'appel.
 */

function envOrNull(name: string) {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function getSupabaseAdminConfig() {
  const url =
    envOrNull("SUPABASE_URL") ||
    envOrNull("SUPABASE_PROJECT_URL") ||
    envOrNull("NEXT_PUBLIC_SUPABASE_URL");

  const key =
    envOrNull("SUPABASE_SERVICE_ROLE_KEY") ||
    envOrNull("SUPABASE_SECRET_KEY") ||
    envOrNull("SUPABASE_SERVICE_KEY");

  return { url, key };
}

// Export compat : supabaseAdmin peut être null si env manquante.
// Les routes doivent appeler requireSupabaseAdmin().
const cfg = getSupabaseAdminConfig();

export const supabaseAdmin =
  cfg.url && cfg.key
    ? createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
    : null;

if (!cfg.url) console.warn("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
if (!cfg.key) console.warn("Missing Supabase service role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY)");

export function requireSupabaseAdmin() {
  const { url, key } = getSupabaseAdminConfig();
  if (!url) throw new Error("Missing Supabase URL env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  if (!key)
    throw new Error(
      "Missing Supabase service role env. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)."
    );
  return createClient(url, key, { auth: { persistSession: false } });
}
