// src/app/api/contract/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Contract API
 * - Reads booking request by rid (booking_requests.id)
 * - Returns a FLAT payload expected by /contract page
 *
 * IMPORTANT:
 * - Pricing / important fields must NOT be editable client-side.
 *   Pricing is returned as read-only fields (server-owned).
 */

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error(
      "Missing Supabase URL env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)."
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role env. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function asNumber(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rid = searchParams.get("rid")?.trim();

    if (!rid) {
      return NextResponse.json(
        { ok: false, error: "Missing rid" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", rid)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ---- Normalize fields from DB (support multiple column names) ----
    const name =
      safeString((data as any).guest_name) ||
      safeString((data as any).name) ||
      safeString((data as any).full_name) ||
      "";

    const email =
      safeString((data as any).guest_email) ||
      safeString((data as any).email) ||
      "";

    const phone =
      safeString((data as any).guest_phone) ||
      safeString((data as any).phone) ||
      "";

    const start_date =
      safeString((data as any).start_date) ||
      safeString((data as any).checkin_date) ||
      safeString((data as any).checkinDate) ||
      "";

    const end_date =
      safeString((data as any).end_date) ||
      safeString((data as any).checkout_date) ||
      safeString((data as any).checkoutDate) ||
      "";

    const nights = asNumber((data as any).nights, 0) ?? 0;

    const adults = asNumber((data as any).adults, 0) ?? 0;
    const children = asNumber((data as any).children, 0) ?? 0;

    const animals_count =
      asNumber((data as any).animals_count, null) ??
      asNumber((data as any).animals, 0) ??
      0;

    const animal_type =
      safeString((data as any).animal_type) ||
      safeString((data as any).animalType) ||
      "";

    const other_animal_label =
      safeString((data as any).other_animal_label) ||
      safeString((data as any).animal_other) ||
      safeString((data as any).animalOther) ||
      "";

    // ---- Pricing (STRICTLY read-only) ----
    // IMPORTANT: pricing.total must exist for /contract page.
    const pricing = {
      // Keep any extra details if you want, but the page mainly uses pricing.total
      base_accommodation:
        asNumber((data as any).price_base_hosting, null) ??
        asNumber((data as any).base_hosting, null),

      cleaning: asNumber((data as any).price_cleaning, 100) ?? 100,

      animals:
        asNumber((data as any).price_animals, null) ??
        asNumber((data as any).animals_fee, null),

      wood:
        asNumber((data as any).price_wood, null) ??
        asNumber((data as any).wood_fee, null),

      visitors:
        asNumber((data as any).price_visitors, null) ??
        asNumber((data as any).visitors_fee, null),

      extra_people:
        asNumber((data as any).price_extra_sleepers, null) ??
        asNumber((data as any).extra_sleepers_fee, null),

      early_arrival:
        asNumber((data as any).price_early_arrival, null) ??
        asNumber((data as any).early_arrival_fee, null),

      late_departure:
        asNumber((data as any).price_late_departure, null) ??
        asNumber((data as any).late_departure_fee, null),

      tourist_tax:
        asNumber((data as any).price_tourist_tax, null) ??
        asNumber((data as any).taxe, null),

      // This is the key used by your page:
      total:
        asNumber((data as any).price_total, null) ??
        asNumber((data as any).estimated_total, 0) ??
        0,

      currency: "EUR",
    };

    // ---- FLAT payload expected by /contract page ----
    const contract = {
      id: rid,

      name: name || null,
      email: email || null,
      phone: phone || null,

      start_date: start_date || null,
      end_date: end_date || null,
      nights: Number.isFinite(Number(nights)) ? Number(nights) : 0,

      adults: Number.isFinite(Number(adults)) ? Number(adults) : 0,
      children: Number.isFinite(Number(children)) ? Number(children) : 0,

      animals_count: Number.isFinite(Number(animals_count)) ? Number(animals_count) : 0,
      animal_type: animal_type || null,
      other_animal_label: other_animal_label || null,

      pricing,
    };

    return NextResponse.json(
      { ok: true, contract },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
