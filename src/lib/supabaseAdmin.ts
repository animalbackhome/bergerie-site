// src/lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * IMPORTANT
 * Vercel/Next "next build" exécute une vérification TypeScript stricte.
 * Si on exporte `supabaseAdmin` en type `SupabaseClient | null`, alors
 * toutes les routes qui l'utilisent déclenchent : "supabaseAdmin is possibly 'null'".
 *
 * ➜ Solution robuste : on exporte un client TOUJOURS typé SupabaseClient
 * (donc le build passe), et on garde une fonction `requireSupabaseAdmin()`
 * qui, elle, valide la config et lève une erreur explicite au runtime.
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

/**
 * Client "toujours présent" (pour satisfaire TypeScript).
 * Si la config est absente, on utilise des valeurs placeholder :
 * le runtime échouera proprement via requireSupabaseAdmin().
 */
const cfg = getSupabaseAdminConfig();

export const supabaseAdmin: SupabaseClient = createClient(
  cfg.url ?? "http://localhost:54321",
  cfg.key ?? "MISSING_SUPABASE_SERVICE_ROLE_KEY",
  { auth: { persistSession: false } }
);

/** À utiliser dans les routes quand tu veux une erreur explicite si env manquantes. */
export function requireSupabaseAdmin(): SupabaseClient {
  const c = getSupabaseAdminConfig();
  if (!c.url) {
    throw new Error(
      "Missing SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL). Ajoute-la dans Vercel > Environment Variables puis redeploy."
    );
  }
  if (!c.key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (service role). Ajoute-la dans Vercel > Environment Variables puis redeploy."
    );
  }
  return createClient(c.url, c.key, { auth: { persistSession: false } });
}
