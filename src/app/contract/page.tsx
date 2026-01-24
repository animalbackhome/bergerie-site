// src/app/contract/page.tsx
import ContractClient from "./ContractClient";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BOOKING_MODERATION_SECRET } from "@/lib/resendServer";
import { verifyContractToken } from "@/lib/contractToken";

export const dynamic = "force-dynamic";

// --- UUID helper (added by patch) ---
const __isUuid = (v: unknown) => {
  if (typeof v !== "string") return false;
  // Accept UUID v1-v5, case-insensitive
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
};
// --- end UUID helper ---

type SearchParamsShape = Record<string, string | string[] | undefined> | URLSearchParams;

type PageProps = {
  // Next.js versions can type this as an object OR a Promise<object>.
  searchParams?: SearchParamsShape | Promise<SearchParamsShape>;
};

async function resolveSearchParams(
  searchParams: PageProps["searchParams"]
): Promise<SearchParamsShape | undefined> {
  if (!searchParams) return undefined;

  // If a Promise was passed (some Next.js typings), await it.
  if (typeof (searchParams as any)?.then === "function") {
    try {
      return (await (searchParams as any)) as SearchParamsShape;
    } catch {
      return undefined;
    }
  }

  return searchParams as SearchParamsShape;
}

function getParam(searchParams: any, key: string): string | undefined {
  if (!searchParams) return undefined;

  // URLSearchParams-like
  if (typeof (searchParams as any)?.get === "function") {
    const v = (searchParams as any).get(key);
    return typeof v === "string" ? v : undefined;
  }

  // Plain object (Next.js App Router): Record<string, string | string[]>
  const raw = (searchParams as any)[key];
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : undefined;
  return typeof raw === "string" ? raw : undefined;
}

function normalizeRid(rid: string | undefined) {
  const s = String(rid || "").trim();
  if (!s) return null;
  return s;
}

export default async function ContractPage(props: PageProps) {
  const sp = await resolveSearchParams(props.searchParams);

  const rid = normalizeRid(getParam(sp, "rid"));
  const t = String(getParam(sp, "t") || "");

  if (!rid || !__isUuid(rid)) {
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

  const { data: booking } = await supabase
    .from("booking_requests")
    .select(
      "id, full_name, email, phone, arrival_date, departure_date, pricing, created_at"
    )
    .eq("id", rid)
    .maybeSingle();

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/90 p-6 border">
          <h1 className="text-xl font-semibold">Contrat</h1>
          <p className="mt-2 text-slate-700">Demande introuvable.</p>
        </div>
      </div>
    );
  }

  const okToken = verifyContractToken({
    rid,
    email: booking.email,
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
      booking={booking as any}
      token={t}
      existing={(existing as any) || null}
    />
  );
}
