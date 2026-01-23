// src/app/api/contract/route.ts
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/contract?rid=...
 * - Lit la demande dans Supabase (table: booking_requests)
 * - Renvoie un payload "verrouillé" (tarifs/pricing côté serveur uniquement)
 *
 * ✅ Réponse attendue par /contract/page.tsx :
 *   { ok: true, data: ContractData }
 *
 * ⚠️ IMPORTANT
 * - Endpoint serveur uniquement (pas de "use client").
 * - NE JAMAIS accepter/prendre le pricing depuis le navigateur : on renvoie seulement ce qui est en DB.
 */

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

function safeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  const t = String(v).trim();
  return t.length ? t : null;
}

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPricingFromLegacyRow(row: any) {
  // Compat : si ton schéma n'avait pas encore une colonne "pricing" JSON,
  // on reconstruit à partir de colonnes possibles.
  const num = (x: any, fb: number | null = null) => {
    const n = safeNumber(x);
    return n === null ? fb : n;
  };

  return {
    base_accommodation:
      num(row?.price_base_hosting) ?? num(row?.base_hosting),

    cleaning: num(row?.price_cleaning, 100) ?? 100,

    animals: num(row?.price_animals) ?? num(row?.animals_fee),

    wood: num(row?.price_wood) ?? num(row?.wood_fee),

    visitors: num(row?.price_visitors) ?? num(row?.visitors_fee),

    extra_people:
      num(row?.price_extra_sleepers) ?? num(row?.extra_sleepers_fee),

    early_arrival:
      num(row?.price_early_arrival) ?? num(row?.early_arrival_fee),

    late_departure:
      num(row?.price_late_departure) ?? num(row?.late_departure_fee),

    tourist_tax: num(row?.price_tourist_tax) ?? num(row?.taxe),

    total:
      num(row?.price_total) ?? num(row?.estimated_total, 0) ?? 0,

    currency: "EUR",
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rid = (url.searchParams.get("rid") || "").trim();

    if (!rid) return jsonError("Paramètre rid manquant.", 400);

    const supabase = requireSupabaseAdmin();

    // ⚠️ Si tes colonnes portent d'autres noms, adapte ici.
    // On tente de récupérer "pricing" + quelques colonnes legacy en fallback.
    const { data, error } = await supabase
      .from("booking_requests")
      .select(
        [
          "id",
          "name",
          "email",
          "phone",
          "start_date",
          "end_date",
          "nights",
          "adults",
          "children",
          "animals_count",
          "animal_type",
          "other_animal_label",
          "pricing",
          // legacy (optionnel)
          "price_total",
          "estimated_total",
          "price_cleaning",
          "price_base_hosting",
          "base_hosting",
          "price_animals",
          "animals_fee",
          "price_wood",
          "wood_fee",
          "price_visitors",
          "visitors_fee",
          "price_extra_sleepers",
          "extra_sleepers_fee",
          "price_early_arrival",
          "early_arrival_fee",
          "price_late_departure",
          "late_departure_fee",
          "price_tourist_tax",
          "taxe",
        ].join(",")
      )
      .eq("id", rid)
      .maybeSingle();

    if (error) return jsonError(error.message || "Erreur Supabase.", 500);
    if (!data) return jsonError("Demande introuvable.", 404);

    const row: any = data;

    const pricing =
      row?.pricing && typeof row.pricing === "object"
        ? row.pricing
        : buildPricingFromLegacyRow(row);

    const payload = {
      id: safeString(row.id) || rid,

      name: safeString(row.name),
      email: safeString(row.email),
      phone: safeString(row.phone),

      start_date: safeString(row.start_date),
      end_date: safeString(row.end_date),
      nights: safeNumber(row.nights),

      adults: safeNumber(row.adults),
      children: safeNumber(row.children),

      animals_count: safeNumber(row.animals_count),
      animal_type: safeString(row.animal_type),
      other_animal_label: safeString(row.other_animal_label),

      // ✅ source of truth serveur
      pricing,
    };

    return NextResponse.json(
      { ok: true, data: payload },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (e: any) {
    return jsonError(e?.message || "Erreur inconnue.", 500);
  }
}
