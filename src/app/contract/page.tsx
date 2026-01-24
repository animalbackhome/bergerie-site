// src/app/contract/page.tsx
import ContractClient from "./ContractClient";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BOOKING_MODERATION_SECRET } from "@/lib/resendServer";
import { verifyContractToken } from "@/lib/contractToken";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getParam(sp: PageProps["searchParams"], key: string) {
  const v = sp?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeRid(rid: string | undefined) {
  const s = String(rid || "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.trunc(n));
}

export default async function ContractPage(props: PageProps) {
  const rid = normalizeRid(getParam(props.searchParams, "rid"));
  const t = String(getParam(props.searchParams, "t") || "");

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

  return <ContractClient booking={booking as any} token={t} existing={(existing as any) || null} />;
}
