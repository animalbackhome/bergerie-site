// src/app/contract/page.tsx
import ContractClient from "./ContractClient";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BOOKING_MODERATION_SECRET } from "@/lib/resendServer";
import { verifyContractToken } from "@/lib/contractToken";

export const dynamic = "force-dynamic";

// --- RID helpers (UUID or positive integer) ---
const __isUuid = (v: unknown) => {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
};

const __isPositiveIntString = (v: unknown) => {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9]+$/.test(s) && Number(s) > 0;
};

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, any>>;
};

async function resolveSearchParams(searchParams: any) {
  if (!searchParams) return undefined;
  if (typeof searchParams?.then === "function") return await searchParams;
  return searchParams;
}

function getParam(searchParams: any, key: string): string | undefined {
  if (!searchParams) return undefined;

  // URLSearchParams-like
  if (typeof searchParams?.get === "function") {
    const v = searchParams.get(key);
    return typeof v === "string" ? v : undefined;
  }

  // Plain object (Next.js App Router)
  const raw = searchParams[key];
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : undefined;
  return typeof raw === "string" ? raw : undefined;
}

function normalizeRid(rid: string | undefined) {
  const s = String(rid || "").trim();
  if (!s) return null;

  // UUID rid (Supabase uuid)
  if (__isUuid(s)) return s;

  // Numeric rid (legacy / optional)
  if (__isPositiveIntString(s)) return String(Math.trunc(Number(s)));

  return null;
}

function __buildFullName(row: any): string {
  const direct =
    row?.full_name ??
    row?.fullName ??
    row?.name ??
    row?.fullname ??
    row?.full ??
    "";
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const first =
    (typeof row?.first_name === "string" ? row.first_name : "") ||
    (typeof row?.firstname === "string" ? row.firstname : "") ||
    (typeof row?.firstName === "string" ? row.firstName : "") ||
    "";
  const last =
    (typeof row?.last_name === "string" ? row.last_name : "") ||
    (typeof row?.lastname === "string" ? row.lastname : "") ||
    (typeof row?.lastName === "string" ? row.lastName : "") ||
    "";

  const joined = `${String(first || "").trim()} ${String(last || "").trim()}`.trim();
  return joined;
}

function __normalizeYmd(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // ISO -> date part
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return null;
  }
  return null;
}

function __computeNights(startYmd: string | null, endYmd: string | null): number | null {
  if (!startYmd || !endYmd) return null;
  try {
    const a = new Date(`${startYmd}T00:00:00Z`).getTime();
    const b = new Date(`${endYmd}T00:00:00Z`).getTime();
    const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(diff) || diff <= 0) return null;
    return diff;
  } catch {
    return null;
  }
}

function __pickNumber(row: any, keys: string[], fallback: number | null = null): number | null {
  for (const k of keys) {
    const v = row?.[k];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

/**
 * ✅ Sécurise le pricing pour le contrat (sans changer le reste)
 * - total reste la source de vérité
 * - options_total (fallback) = total - base_accommodation - cleaning - tourist_tax
 * - ne supprime rien, n’invente pas d’options détaillées
 */
function __normalizePricing(pricing: any) {
  if (!pricing || typeof pricing !== "object") return pricing;

  const total = Number(pricing.total);
  if (!Number.isFinite(total)) return pricing;

  const base = Number(pricing.base_accommodation);
  const cleaning = Number(pricing.cleaning);
  const touristTax = Number(pricing.tourist_tax);

  const baseN = Number.isFinite(base) ? base : 0;
  const cleaningN = Number.isFinite(cleaning) ? cleaning : 0;
  const touristTaxN = Number.isFinite(touristTax) ? touristTax : 0;

  const optionsTotalExisting = Number(pricing.options_total);
  if (Number.isFinite(optionsTotalExisting)) return pricing;

  const options_total = Math.round((total - baseN - cleaningN - touristTaxN) * 100) / 100;

  return {
    ...pricing,
    options_total: options_total,
  };
}

export default async function ContractPage(props: PageProps) {
  const sp = await resolveSearchParams((props as any).searchParams);
  const rid = normalizeRid(getParam(sp, "rid"));
  const t = String(getParam(sp, "t") || "");

  if (!rid) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">Lien invalide : rid manquant.</p>
        </div>
      </div>
    );
  }

  const supabase = requireSupabaseAdmin();

  const { data: bookingRaw, error: bookingErr } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("id", rid)
    .maybeSingle();

  if (bookingErr) {
    console.error("[contract] booking_requests fetch error", bookingErr);
  }

  if (!bookingRaw) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">Demande introuvable.</p>
        </div>
      </div>
    );
  }

  // ✅ Dates (compat)
  const startYmd =
    __normalizeYmd((bookingRaw as any).start_date) ??
    __normalizeYmd((bookingRaw as any).arrival_date) ??
    __normalizeYmd((bookingRaw as any).checkin) ??
    __normalizeYmd((bookingRaw as any).checkIn) ??
    null;

  const endYmd =
    __normalizeYmd((bookingRaw as any).end_date) ??
    __normalizeYmd((bookingRaw as any).departure_date) ??
    __normalizeYmd((bookingRaw as any).checkout) ??
    __normalizeYmd((bookingRaw as any).checkOut) ??
    null;

  if (!startYmd || !endYmd) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">
            Demande invalide : dates manquantes (arrivée/départ).
          </p>
        </div>
      </div>
    );
  }

  // ✅ Nights (compat + recalcul)
  const nightsRaw =
    (typeof (bookingRaw as any).nights === "number" && Number.isFinite((bookingRaw as any).nights)
      ? (bookingRaw as any).nights
      : Number((bookingRaw as any).nights)) ?? null;

  const nights =
    (Number.isFinite(nightsRaw) && (nightsRaw as any) > 0 ? Math.trunc(nightsRaw as any) : null) ??
    __computeNights(startYmd, endYmd);

  // ✅ Compteurs (compat : ton API enregistre adults/children)
  const adults_count =
    __pickNumber(bookingRaw, ["adults_count", "adultsCount", "adults"], null) ?? null;

  const children_count =
    __pickNumber(bookingRaw, ["children_count", "childrenCount", "children"], null) ?? null;

  const animals_count =
    __pickNumber(bookingRaw, ["animals_count", "animalsCount", "animals", "pets", "pets_count", "petsCount"], null) ??
    null;

  const pricingNormalized = __normalizePricing((bookingRaw as any).pricing ?? null);

  // ✅ IMPORTANT: on expose rid sous plusieurs clés
  // pour que le client/API ne “perde” jamais l’id au submit.
  const booking = {
    // identifiants
    id: (bookingRaw as any).id,
    booking_request_id: (bookingRaw as any).id,
    rid: (bookingRaw as any).id,

    // identité
    full_name: __buildFullName(bookingRaw),
    email: (bookingRaw as any).email ?? "",
    phone: (bookingRaw as any).phone ?? "",

    // voyageurs / animaux
    adults_count,
    children_count,
    animals_count,

    // dates (ContractClient attend arrival/departure)
    arrival_date: startYmd,
    departure_date: endYmd,
    nights: nights ?? null,

    // pricing & metadata
    pricing: pricingNormalized,
    created_at: (bookingRaw as any).created_at ?? null,
  };

  // Token:
  // - Si "t" absent => on autorise l'affichage (fallback).
  // - Si "t" présent => on vérifie.
  let okToken = true;
  if (t) {
    okToken = verifyContractToken({
      rid,
      email: booking.email,
      secret: BOOKING_MODERATION_SECRET,
      token: t,
    });
  }

  if (!okToken) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">Lien invalide (token).</p>
        </div>
      </div>
    );
  }

  const { data: existing } = await supabase
    .from("booking_contracts")
    .select(
      "booking_request_id, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants, signed_at"
    )
    .eq("booking_request_id", rid)
    .maybeSingle();

  return (
    <ContractClient
      booking={booking as any}
      token={t}
      existing={(existing as any) || null}
    />
  );
}
