// src/app/api/booking-request/route.ts
import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend, RESEND_FROM, SITE_URL } from "@/lib/resendServer";

type Payload = {
  name?: string;
  email?: string;
  phone?: string;

  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nights?: number;

  adults?: number;
  children?: number;

  animalType?: string;
  otherAnimalLabel?: string;
  animalsCount?: number;

  woodQuarterSteres?: number;
  visitorsCount?: number;

  extraSleepersCount?: number;
  extraSleepersNights?: number;

  earlyArrival?: boolean;
  lateDeparture?: boolean;

  pricing?: {
    base?: number;
    cleaningFee?: number;
    animalsCost?: number;
    woodCost?: number;
    visitorsCost?: number;
    extraSleepersCost?: number;
    earlyArrivalCost?: number;
    lateDepartureCost?: number;
    touristTax?: number;
    total?: number;
  };

  message?: string;

  airbnbCalendarUrl?: string;
};

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEUR(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function envOrNull(name: string) {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

const BOOKING_NOTIFY_EMAIL = envOrNull("BOOKING_NOTIFY_EMAIL"); // ton email (admin)
const BOOKING_REPLY_TO = envOrNull("BOOKING_REPLY_TO"); // optionnel: adresse qui reçoit les réponses clients (sinon = email client)
const BOOKING_MODERATION_SECRET = envOrNull("BOOKING_MODERATION_SECRET"); // obligatoire pour liens signés

function signModerationLink(params: {
  id: string;
  action: "accept" | "reject" | "reply";
  exp: number;
}) {
  if (!BOOKING_MODERATION_SECRET) return null;
  const msg = `${params.id}.${params.action}.${params.exp}`;
  const sig = createHmac("sha256", BOOKING_MODERATION_SECRET).update(msg).digest("hex");
  const url = new URL("/api/booking-request/moderate", SITE_URL);
  url.searchParams.set("id", params.id);
  url.searchParams.set("action", params.action);
  url.searchParams.set("exp", String(params.exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

function validateEmailLike(v: string) {
  return v.includes("@") && v.includes(".");
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();

  const startDate = (body.startDate || "").trim();
  const endDate = (body.endDate || "").trim();
  const nights = Number.isFinite(body.nights) ? Number(body.nights) : 0;

  const adults = Number.isFinite(body.adults) ? Number(body.adults) : 0;
  const children = Number.isFinite(body.children) ? Number(body.children) : 0;

  const animalType = (body.animalType || "").trim();
  const otherAnimalLabel = (body.otherAnimalLabel || "").trim();
  const animalsCount = Number.isFinite(body.animalsCount) ? Number(body.animalsCount) : 0;

  const woodQuarterSteres = Number.isFinite(body.woodQuarterSteres) ? Number(body.woodQuarterSteres) : 0;
  const visitorsCount = Number.isFinite(body.visitorsCount) ? Number(body.visitorsCount) : 0;

  const extraSleepersCount = Number.isFinite(body.extraSleepersCount) ? Number(body.extraSleepersCount) : 0;
  const extraSleepersNights = Number.isFinite(body.extraSleepersNights) ? Number(body.extraSleepersNights) : 0;

  const earlyArrival = !!body.earlyArrival;
  const lateDeparture = !!body.lateDeparture;

  const message = (body.message || "").trim();
  const airbnbCalendarUrl = (body.airbnbCalendarUrl || "").trim();

  const pricing = body.pricing || {};
  const total = Number.isFinite(pricing.total) ? Number(pricing.total) : 0;

  if (!name || !email || !message || !startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (!validateEmailLike(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (nights <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid dates/nights" }, { status: 400 });
  }
  if (!BOOKING_NOTIFY_EMAIL) {
    return NextResponse.json(
      { ok: false, error: "Server not configured (BOOKING_NOTIFY_EMAIL missing)" },
      { status: 500 }
    );
  }

  // Insert Supabase
  const { data, error } = await supabaseAdmin
    .from("booking_requests")
    .insert({
      status: "pending",
      name,
      email,
      phone: phone || null,
      start_date: startDate,
      end_date: endDate,
      nights,
      adults,
      children,
      animal_type: animalType || null,
      other_animal_label: otherAnimalLabel || null,
      animals_count: animalsCount,
      wood_quarter_steres: woodQuarterSteres,
      visitors_count: visitorsCount,
      extra_sleepers_count: extraSleepersCount,
      extra_sleepers_nights: extraSleepersNights,
      early_arrival: earlyArrival,
      late_departure: lateDeparture,
      message,
      pricing: pricing as any,
      airbnb_calendar_url: airbnbCalendarUrl || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const id = data.id as string;

  // Liens signés (expire 7 jours)
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const acceptUrl = signModerationLink({ id, action: "accept", exp });
  const rejectUrl = signModerationLink({ id, action: "reject", exp });
  const replyUrl = signModerationLink({ id, action: "reply", exp });

  const pricingLines = [
    `Base hébergement: ${formatEUR(Number(pricing.base || 0))}`,
    `Ménage (fixe): ${formatEUR(Number(pricing.cleaningFee || 0))}`,
    `Animaux: ${formatEUR(Number(pricing.animalsCost || 0))}`,
    `Bois: ${formatEUR(Number(pricing.woodCost || 0))}`,
    `Visiteurs: ${formatEUR(Number(pricing.visitorsCost || 0))}`,
    `Personnes en plus (nuits): ${formatEUR(Number(pricing.extraSleepersCost || 0))}`,
    `Arrivée début de journée: ${formatEUR(Number(pricing.earlyArrivalCost || 0))}`,
    `Départ fin de journée: ${formatEUR(Number(pricing.lateDepartureCost || 0))}`,
    `Taxe de séjour: ${formatEUR(Number(pricing.touristTax || 0))}`,
    `TOTAL estimé: ${formatEUR(total)}`,
  ].join("\n");

  // Email admin (toi)
  try {
    const plainText =
      `Nouvelle demande de réservation:\n\n` +
      `Nom: ${name}\nEmail: ${email}\nTéléphone: ${phone || "—"}\n\n` +
      `Dates: ${startDate} -> ${endDate} (${nights} nuit(s))\n` +
      `Voyageurs: ${adults} adulte(s) + ${children} enfant(s)\n` +
      `Animaux: ${animalsCount} (${animalType}${animalType === "autre" && otherAnimalLabel ? ` - ${otherAnimalLabel}` : ""})\n\n` +
      `Options:\n` +
      `- Arrivée début de journée: ${earlyArrival ? "Oui (+70€)" : "Non"}\n` +
      `- Départ fin de journée: ${lateDeparture ? "Oui (+70€)" : "Non"}\n` +
      `- Bois: ${woodQuarterSteres} x 1/4 stère\n` +
      `- Visiteurs: ${visitorsCount}\n` +
      `- Personnes en plus qui dorment: ${extraSleepersCount} (nuits: ${extraSleepersNights})\n\n` +
      `Détail prix:\n${pricingLines}\n\n` +
      `Message:\n${message}\n\n` +
      `ID: ${id}\n` +
      (acceptUrl && rejectUrl && replyUrl
        ? `\n✅ Accepter: ${acceptUrl}\n❌ Refuser: ${rejectUrl}\n💬 Répondre: ${replyUrl}\n`
        : `\n(⚠️ Liens désactivés: BOOKING_MODERATION_SECRET manquante)\n`);

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.4">
        <h2 style="margin:0 0 12px">Nouvelle demande de réservation</h2>
        <p style="margin:0 0 10px">
          <b>Nom :</b> ${escapeHtml(name)}<br/>
          <b>Email :</b> ${escapeHtml(email)}<br/>
          <b>Téléphone :</b> ${escapeHtml(phone || "—")}
        </p>

        <p style="margin:0 0 10px">
          <b>Dates :</b> ${escapeHtml(startDate)} → ${escapeHtml(endDate)} (${nights} nuit(s))<br/>
          <b>Voyageurs :</b> ${adults} adulte(s) + ${children} enfant(s)<br/>
          <b>Animaux :</b> ${animalsCount} (${escapeHtml(animalType || "—")}${animalType === "autre" && otherAnimalLabel ? ` — ${escapeHtml(otherAnimalLabel)}` : ""})
        </p>

        <p style="margin:0 0 8px"><b>Message :</b></p>
        <div style="white-space:pre-wrap;background:#0b1220;color:#e5e7eb;padding:12px;border-radius:10px">
          ${escapeHtml(message)}
        </div>

        <p style="margin:12px 0 8px"><b>Détail prix :</b></p>
        <div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:10px">
          ${escapeHtml(pricingLines)}
        </div>

        <p style="margin:12px 0 10px;color:#6b7280;font-size:12px">ID: ${escapeHtml(id)}</p>

        ${
          acceptUrl && rejectUrl && replyUrl
            ? `
            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
              <a href="${acceptUrl}" style="background:#16a34a;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block">✅ Accepter</a>
              <a href="${rejectUrl}" style="background:#dc2626;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block">❌ Refuser</a>
              <a href="${replyUrl}" style="background:#2563eb;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block">💬 Répondre</a>
            </div>
            <p style="margin:10px 0 0;color:#6b7280;font-size:12px">Les liens expirent dans 7 jours.</p>
            `
            : `
            <p style="margin-top:12px;color:#b45309">
              ⚠️ Liens désactivés : variable <code>BOOKING_MODERATION_SECRET</code> manquante.
            </p>
            `
        }

        ${
          airbnbCalendarUrl
            ? `<p style="margin-top:12px"><b>Lien Airbnb (calendrier) :</b> <a href="${escapeHtml(airbnbCalendarUrl)}">${escapeHtml(airbnbCalendarUrl)}</a></p>`
            : ""
        }
      </div>
    `;

    await resend.emails.send({
      from: RESEND_FROM,
      to: BOOKING_NOTIFY_EMAIL,
      replyTo: BOOKING_REPLY_TO || email, // toi tu peux répondre facilement
      subject: "Nouvelle demande de réservation (bergerie-site)",
      text: plainText,
      html,
    });
  } catch (e) {
    console.warn("Resend send failed:", e);
  }

  // Email client (accusé de réception + “spam”)
  try {
    const clientText =
      `Bonjour ${name},\n\n` +
      `Merci, votre demande a bien été envoyée.\n` +
      `Vous recevrez une réponse par e-mail dans les plus brefs délais.\n\n` +
      `IMPORTANT : si vous ne voyez pas notre message, merci de vérifier votre dossier Courrier indésirable / Spam ainsi que l’onglet Promotions (Gmail).\n\n` +
      `En cas de doute, vous pouvez répondre directement à l’e-mail que vous allez recevoir, en indiquant votre nom et vos dates de séjour.\n\n` +
      `Récapitulatif :\n` +
      `Dates : ${startDate} → ${endDate} (${nights} nuit(s))\n` +
      `Voyageurs : ${adults} adulte(s) + ${children} enfant(s)\n` +
      `Total estimé : ${formatEUR(total)}\n\n` +
      `Cordialement,\n` +
      `Superbe bergerie en cœur de forêt – piscine & lac`;

    const clientHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5">
        <h2 style="margin:0 0 10px">Demande envoyée ✅</h2>
        <p style="margin:0 0 10px">Bonjour ${escapeHtml(name)},</p>
        <p style="margin:0 0 10px">
          Merci, votre demande a bien été envoyée.<br/>
          Vous recevrez une réponse par e-mail dans les plus brefs délais.
        </p>
        <p style="margin:0 0 10px">
          <b style="color:#dc2626">
            Important : si vous ne voyez pas notre message, merci de vérifier votre dossier Courrier indésirable / Spam ainsi que l’onglet Promotions (Gmail).
          </b>
        </p>
        <p style="margin:0 0 12px">
          En cas de doute, vous pouvez répondre directement à l’e-mail que vous allez recevoir, en indiquant votre nom et vos dates de séjour.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px">
          <div><b>Dates :</b> ${escapeHtml(startDate)} → ${escapeHtml(endDate)} (${nights} nuit(s))</div>
          <div><b>Voyageurs :</b> ${adults} adulte(s) + ${children} enfant(s)</div>
          <div><b>Total estimé :</b> ${escapeHtml(formatEUR(total))}</div>
        </div>

        <p style="margin:14px 0 0;color:#64748b;font-size:12px">
          Ceci est un accusé de réception automatique.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      replyTo: BOOKING_REPLY_TO || BOOKING_NOTIFY_EMAIL || undefined,
      subject: "Votre demande a bien été envoyée — Superbe bergerie",
      text: clientText,
      html: clientHtml,
    });
  } catch (e) {
    console.warn("Resend client mail failed:", e);
  }

  return NextResponse.json({ ok: true, id }, { status: 200 });
}
