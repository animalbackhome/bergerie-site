// src/app/api/contract/route.ts
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  BOOKING_MODERATION_SECRET,
  BOOKING_NOTIFY_EMAIL,
  BOOKING_REPLY_TO,
  RESEND_FROM,
  SITE_URL,
  requireResend,
} from "@/lib/resendServer";
import { verifyContractToken } from "@/lib/contractToken";
import { renderContractText } from "@/lib/contractTemplate";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mustStr(v: unknown) {
  const s = String(v ?? "").trim();
  return s;
}

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

function normalizeRid(rid: string | null) {
  const s = mustStr(rid);
  if (!s) return null;

  // UUID rid (Supabase uuid)
  if (__isUuid(s)) return s;

  // Numeric rid (legacy / optional)
  if (__isPositiveIntString(s)) return String(Math.trunc(Number(s)));

  return null;
}

function formatDateFR(d: string) {
  // d attendu: YYYY-MM-DD
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d);
  if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function nightsBetween(arrival: string, departure: string) {
  const a = new Date(`${arrival}T00:00:00Z`).getTime();
  const b = new Date(`${departure}T00:00:00Z`).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function safeNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rid = normalizeRid(searchParams.get("rid"));
  const t = searchParams.get("t");
  if (!rid) return jsonError("Missing rid", 400);

  const supabase = requireSupabaseAdmin();

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .select(
      "id, created_at, full_name, email, phone, arrival_date, departure_date, adults_count, children_count, animals_count, message, pricing"
    )
    .eq("id", rid)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!booking) return jsonError("Booking request not found", 404);

  // IMPORTANT:
  // - Si "t" absent => on autorise (fallback) pour ne pas bloquer le flux.
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
  if (!okToken) return jsonError("Invalid token", 403);

  const { data: contract } = await supabase
    .from("booking_contracts")
    .select(
      "id, booking_request_id, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants, signed_at"
    )
    .eq("booking_request_id", rid)
    .maybeSingle();

  return NextResponse.json({ ok: true, booking, contract });
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const rid = normalizeRid(mustStr(body?.rid));
  const t = mustStr(body?.t);
  if (!rid) return jsonError("Missing rid", 400);

  const addressLine1 = mustStr(body?.signer_address_line1);
  const addressLine2 = mustStr(body?.signer_address_line2);
  const postalCode = mustStr(body?.signer_postal_code);
  const city = mustStr(body?.signer_city);
  const country = mustStr(body?.signer_country);
  const occupants = Array.isArray(body?.occupants) ? body.occupants : [];
  const acceptedTerms = Boolean(body?.accepted_terms);

  if (!addressLine1 || !postalCode || !city || !country) {
    return jsonError("Adresse incomplète.", 400);
  }
  if (!acceptedTerms) {
    return jsonError("Vous devez accepter le contrat.", 400);
  }

  // Validation occupants : {first_name,last_name,age}
  const normOccupants = occupants
    .map((o: any) => ({
      first_name: mustStr(o?.first_name),
      last_name: mustStr(o?.last_name),
      age: mustStr(o?.age),
    }))
    .filter((o: any) => o.first_name && o.last_name && o.age);

  if (normOccupants.length === 0) {
    return jsonError("Ajoutez au moins une personne (nom, prénom, âge).", 400);
  }

  const supabase = requireSupabaseAdmin();

  const { data: booking, error: bookingErr } = await supabase
    .from("booking_requests")
    .select(
      "id, full_name, email, phone, arrival_date, departure_date, adults_count, children_count, pricing, created_at"
    )
    .eq("id", rid)
    .maybeSingle();

  if (bookingErr) return jsonError(bookingErr.message, 500);
  if (!booking) return jsonError("Booking request not found", 404);

  // Token:
  // - Si "t" absent => on autorise (fallback) pour ne pas bloquer le flux.
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
  if (!okToken) return jsonError("Invalid token", 403);

  // Enforce occupants count when available on booking request
  const expected =
    (safeNumber((booking as any).adults_count) ?? 0) + (safeNumber((booking as any).children_count) ?? 0);
  if (expected > 0 && normOccupants.length !== expected) {
    return jsonError(`Vous devez renseigner exactement ${expected} personne(s), comme dans votre demande.`, 400);
  }

  // Upsert (NOTE: no accepted_terms column in booking_contracts)
  const { data: saved, error: upErr } = await supabase
    .from("booking_contracts")
    .upsert(
      {
        booking_request_id: rid,
        signer_address_line1: addressLine1,
        signer_address_line2: addressLine2 || null,
        signer_postal_code: postalCode,
        signer_city: city,
        signer_country: country,
        occupants: normOccupants,
        ip: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      },
      { onConflict: "booking_request_id" }
    )
    .select(
      "id, booking_request_id, signed_at, signer_address_line1, signer_address_line2, signer_postal_code, signer_city, signer_country, occupants"
    )
    .single();

  if (upErr) return jsonError(upErr.message, 500);

  // Email
  const resend = requireResend();
  const baseUrl = SITE_URL ? SITE_URL.replace(/\/$/, "") : "";
  const contractUrl = baseUrl ? `${baseUrl}/contract?rid=${rid}${t ? `&t=${encodeURIComponent(t)}` : ""}` : "";

  const nights = nightsBetween(booking.arrival_date, booking.departure_date);
  const totalPrice =
    booking?.pricing?.total != null ? `${Number(booking.pricing.total).toFixed(2)} €` : "";

  const addressText = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${postalCode} ${city}, ${country}`;
  const occupantsText = normOccupants
    .map((o: any) => `- ${o.first_name} ${o.last_name} (${o.age} ans)`)
    .join("\n");

  const contractText = renderContractText({
    fullName: booking.full_name,
    email: booking.email,
    phone: booking.phone,
    arrivalDate: formatDateFR(booking.arrival_date),
    departureDate: formatDateFR(booking.departure_date),
    nights,
    totalPrice,
    address: addressText,
    occupantsText,
  });

  const subject = `Contrat signé — Demande #${rid}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
      <h2>${subject}</h2>
      <p><b>Réservant</b> : ${escapeHtml(booking.full_name)} — ${escapeHtml(booking.email)} — ${escapeHtml(booking.phone || "")}</p>
      <p><b>Dates</b> : ${escapeHtml(formatDateFR(booking.arrival_date))} → ${escapeHtml(formatDateFR(booking.departure_date))} (${nights} nuit(s))</p>
      ${totalPrice ? `<p><b>Total</b> : ${escapeHtml(totalPrice)}</p>` : ""}
      <p><b>Adresse</b> : ${escapeHtml(addressText)}</p>
      <p><b>Personnes présentes</b> :<br/>${escapeHtml(occupantsText).replace(/\n/g, "<br/>")}</p>
      ${contractUrl ? `<p><a href="${contractUrl}">Voir le contrat en ligne</a></p>` : ""}
      <hr/>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
    </div>
  `;

  const recipientsOwner = BOOKING_NOTIFY_EMAIL ? [BOOKING_NOTIFY_EMAIL] : [];

  // email au propriétaire (si configuré)
  if (recipientsOwner.length) {
    await resend.emails.send({
      from: RESEND_FROM,
      to: recipientsOwner,
      replyTo: BOOKING_REPLY_TO || undefined,
      subject,
      html,
    });
  }

  // email au client
  await resend.emails.send({
    from: RESEND_FROM,
    to: [booking.email],
    replyTo: BOOKING_REPLY_TO || undefined,
    subject: "Votre contrat est signé ✅",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
        <h2>Merci ! Votre contrat est signé ✅</h2>
        <p>Vous pouvez conserver ce message comme preuve.</p>
        ${contractUrl ? `<p><a href="${contractUrl}">Revoir le contrat en ligne</a></p>` : ""}
        <hr/>
        <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(contractText)}</pre>
      </div>
    `,
  });

  return NextResponse.json({ ok: true, contract: saved });
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
