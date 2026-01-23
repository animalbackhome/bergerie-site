// src/app/api/contract/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Contract API
 * - Reads booking request by rid (booking_requests.id)
 * - Returns a FLAT payload expected by /contract page
 *
 * IMPORTANT:
 * - All pricing + important info are SERVER-OWNED and must not be editable.
 * - We return pricing breakdown from the stored JSON (booking_requests.pricing).
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

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function asNumber(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function safeBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "1" || t === "true" || t === "yes" || t === "oui";
  }
  return false;
}

function normalizePricing(p: any) {
  const base = asNumber(p?.base, 0) ?? 0;
  const cleaningFee = asNumber(p?.cleaningFee, 100) ?? 100;
  const animalsCost = asNumber(p?.animalsCost, 0) ?? 0;
  const woodCost = asNumber(p?.woodCost, 0) ?? 0;
  const visitorsCost = asNumber(p?.visitorsCost, 0) ?? 0;
  const extraSleepersCost = asNumber(p?.extraSleepersCost, 0) ?? 0;
  const earlyArrivalCost = asNumber(p?.earlyArrivalCost, 0) ?? 0;
  const lateDepartureCost = asNumber(p?.lateDepartureCost, 0) ?? 0;
  const touristTax = asNumber(p?.touristTax, 0) ?? 0;

  const totalFromPayload = asNumber(p?.total, null);
  const computed =
    base +
    cleaningFee +
    animalsCost +
    woodCost +
    visitorsCost +
    extraSleepersCost +
    earlyArrivalCost +
    lateDepartureCost +
    touristTax;

  const total = Number.isFinite(Number(totalFromPayload))
    ? Number(totalFromPayload)
    : Math.round(computed * 100) / 100;

  return {
    base,
    cleaningFee,
    animalsCost,
    woodCost,
    visitorsCost,
    extraSleepersCost,
    earlyArrivalCost,
    lateDepartureCost,
    touristTax,
    total,
    currency: "EUR",
  };
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
      asNumber((data as any).animalsCount, null) ??
      asNumber((data as any).animals, 0) ??
      0;

    const animal_type =
      safeString((data as any).animal_type) ||
      safeString((data as any).animalType) ||
      "";

    const other_animal_label =
      safeString((data as any).other_animal_label) ||
      safeString((data as any).otherAnimalLabel) ||
      safeString((data as any).animal_other) ||
      safeString((data as any).animalOther) ||
      "";

    const woodQuarterSteres =
      asNumber((data as any).wood_quarter_steres, null) ??
      asNumber((data as any).woodQuarterSteres, null) ??
      0;

    const visitorsCount =
      asNumber((data as any).visitors_count, null) ??
      asNumber((data as any).visitorsCount, null) ??
      asNumber((data as any).visitors, null) ??
      0;

    const extraSleepersCount =
      asNumber((data as any).extra_sleepers_count, null) ??
      asNumber((data as any).extraSleepersCount, null) ??
      0;

    const extraSleepersNights =
      asNumber((data as any).extra_sleepers_nights, null) ??
      asNumber((data as any).extraSleepersNights, null) ??
      0;

    const earlyArrival =
      safeBool((data as any).early_arrival) ||
      safeBool((data as any).earlyArrival) ||
      safeBool((data as any).arrival_early);

    const lateDeparture =
      safeBool((data as any).late_departure) ||
      safeBool((data as any).lateDeparture) ||
      safeBool((data as any).departure_late);

    const message = safeString((data as any).message);

    // ---- Pricing (STRICTLY read-only) ----
    // Primary source: booking_requests.pricing JSON (written by /api/booking-request).
    const pricingFromJson = (data as any).pricing;
    const pricing = normalizePricing(pricingFromJson);

    // Optional legacy fallback if you add separate columns later
    const legacyTotal =
      asNumber((data as any).price_total, null) ??
      asNumber((data as any).estimated_total, null);

    const finalPricing =
      pricingFromJson && typeof pricingFromJson === "object"
        ? pricing
        : {
            ...pricing,
            total: Number.isFinite(Number(legacyTotal))
              ? Number(legacyTotal)
              : pricing.total,
          };

    // ---- FLAT payload expected by /contract page ----
    // NOTE: The client must treat ALL fields below as READ-ONLY.
    const flat = {
      id: rid,

      name: name || null,
      email: email || null,
      phone: phone || null,

      start_date: start_date || null,
      end_date: end_date || null,
      nights: Number.isFinite(Number(nights)) ? Number(nights) : 0,

      adults: Number.isFinite(Number(adults)) ? Number(adults) : 0,
      children: Number.isFinite(Number(children)) ? Number(children) : 0,

      animals_count: Number.isFinite(Number(animals_count))
        ? Number(animals_count)
        : 0,
      animal_type: animal_type || null,
      other_animal_label: other_animal_label || null,

      wood_quarter_steres: Number.isFinite(Number(woodQuarterSteres))
        ? Number(woodQuarterSteres)
        : 0,
      visitors_count: Number.isFinite(Number(visitorsCount))
        ? Number(visitorsCount)
        : 0,
      extra_sleepers_count: Number.isFinite(Number(extraSleepersCount))
        ? Number(extraSleepersCount)
        : 0,
      extra_sleepers_nights: Number.isFinite(Number(extraSleepersNights))
        ? Number(extraSleepersNights)
        : 0,
      early_arrival: !!earlyArrival,
      late_departure: !!lateDeparture,

      message: message || null,

      // Pricing used by /contract (read-only)
      pricing: finalPricing,
    };

    // /contract/page.tsx expects json.data
    return NextResponse.json(
      { ok: true, data: flat },
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
