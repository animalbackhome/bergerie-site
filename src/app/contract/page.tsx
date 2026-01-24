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

  // Plain object (Next.js App Router): Record<string, string | string[]>
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

  // NOTE: select("*") to avoid breaking when column names evolve.
  const { data: bookingRaw, error: bookingError } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("id", rid)
    .maybeSingle();

  if (bookingError) {
    console.error("ContractPage: booking_requests select error", bookingError);
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">Demande introuvable.</p>
        </div>
      </div>
    );
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

  const bookingAny = bookingRaw as any;

  // Provide backward-compatible field aliases (so ContractClient keeps working)
  const bookingForClient = {
    ...bookingAny,
    full_name:
      bookingAny.full_name ??
      bookingAny.name ??
      bookingAny.fullName ??
      bookingAny.nom ??
      "",
    arrival_date:
      bookingAny.arrival_date ??
      bookingAny.start_date ??
      bookingAny.arrivalDate ??
      bookingAny.date_arrivee ??
      null,
    departure_date:
      bookingAny.departure_date ??
      bookingAny.end_date ??
      bookingAny.departureDate ??
      bookingAny.date_depart ??
      null,
  };

  const okToken = verifyContractToken({
    rid,
    email: bookingAny.email,
    secret: BOOKING_MODERATION_SECRET,
    token: t,
  });

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
      booking={bookingForClient as any}
      token={t}
      existing={(existing as any) || null}
    />
  );
}
