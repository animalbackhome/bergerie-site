// src/app/api/booking-request/route.ts
import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resend,
  RESEND_FROM,
  SITE_URL,
  BOOKING_NOTIFY_EMAIL,
  BOOKING_REPLY_TO,
  BOOKING_MODERATION_SECRET,
  BOOKING_BASE_PRICE_PER_NIGHT,
  BOOKING_TOURIST_TAX_PER_ADULT_NIGHT,
  BOOKING_CLEANING_FEE_FIXED,
  BOOKING_ANIMAL_FEE_PER_NIGHT,
  BOOKING_WOOD_PRICE_PER_QUARTER_STERE,
  BOOKING_VISITOR_FEE_PER_PERSON,
  BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT,
  BOOKING_EARLY_ARRIVAL_FEE,
  BOOKING_LATE_DEPARTURE_FEE,
} from "@/lib/resendServer";

export const runtime = "nodejs";

/**
 * POST /api/booking-request
 * - Reçoit une demande de réservation (depuis le formulaire Contact)
 * - Recalcule le pricing côté serveur (verrouillage : ignore tout total envoyé par le client)
 * - Insert dans Supabase (table booking_requests) avec status: "pending" + pricing (objet)
 * - Envoie 2 emails via Resend :
 *    1) Admin (toi) : récap + 3 boutons (Accepter / Refuser / Répondre) via liens signés
 *    2) Client : accusé de réception
 *
 * IMPORTANT
 * - Le pricing côté serveur est la source de vérité : on ne fait jamais confiance à un total client.
 * - Les liens de modération DOIVENT matcher /api/booking-request/moderate/route.ts :
 *    - action = "accept" | "reject" | "reply"
 *    - signature HMAC = sha256(secret, `${id}.${action}.${exp}`)
 */

/* ------------------ Utils ------------------ */

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function safeInt(v: unknown, fallback = 0) {
  // ✅ robuste: accepte les strings "2", "2 (½)", "2 chien(s)" etc.
  if (typeof v === "number") {
    return Number.isFinite(v) ? Math.trunc(v) : fallback;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return fallback;
    // on récupère le premier entier trouvé dans la string
    const m = /-?\d+/.exec(s);
    if (!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeBool(v: unknown) {
  // ✅ important : beaucoup de formulaires envoient "on" pour les checkboxes
  return (
    v === true ||
    v === "true" ||
    v === 1 ||
    v === "1" ||
    v === "on" ||
    v === "yes" ||
    v === "y"
  );
}

/**
 * ✅ FIX: certains formulaires envoient les options dans un objet imbriqué (options/pricing/values/etc).
 * On cherche donc les clés à la racine + dans quelques conteneurs fréquents.
 * (Aucun changement d’email / HTML : on corrige juste les valeurs qui alimentent le pricing serveur.)
 */
function pickFirst(body: any, keys: string[]) {
  const containers = [
    body,
    body?.options,
    body?.opts,
    body?.pricing,
    body?.pricingPreview,
    body?.pricing_preview,
    body?.prices,
    body?.extras,
    body?.fields,
    body?.values,
    body?.data,
    body?.payload,
    body?.booking,
    body?.booking_request,
    body?.bookingRequest,
    body?.form,
    body?.formData,
    body?.animals,
    body?.animal,
    body?.pets,
    body?.pet,
    body?.wood,
    body?.visitors,
    body?.extra_people,
    body?.extraPeople
  ];

  for (const k of keys) {
    for (const obj of containers) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return undefined;
}

function pickInt(body: any, keys: string[], fallback = 0) {
  return safeInt(pickFirst(body, keys), fallback);
}

function pickBool(body: any, keys: string[]) {
  return safeBool(pickFirst(body, keys));
}

function isValidEmail(email: string) {
  // validation simple (suffisante ici)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeYmd(input: unknown) {
  if (input == null) return "";

  // 1) "YYYY-MM-DD"
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // 2) ISO string "YYYY-MM-DDTHH:mm:ssZ" -> take date part
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

    return "";
  }

  // 3) timestamp number
  if (typeof input === "number" && Number.isFinite(input)) {
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) return "";
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 4) Date object
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "";
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function pickDateField(body: any, kind: "start" | "end") {
  // Supporte plusieurs conventions côté client pour éviter les régressions :
  // - start_date / end_date (convention serveur)
  // - startDate / endDate
  // - checkin / checkout, checkIn / checkOut
  // - dates: { from, to } (certains datepickers)
  const candidates =
    kind === "start"
      ? [
          body?.start_date,
          body?.startDate,
          body?.checkin,
          body?.checkIn,
          body?.dates?.from,
          body?.dates?.start,
        ]
      : [
          body?.end_date,
          body?.endDate,
          body?.checkout,
          body?.checkOut,
          body?.dates?.to,
          body?.dates?.end,
        ];

  for (const c of candidates) {
    const ymd = normalizeYmd(c);
    if (ymd) return ymd;
  }
  return "";
}

function parseYmd(s: string) {
  // attend "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  // Date UTC (évite les surprises de timezone)
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  // Vérif cohérence
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function diffNights(checkinYmd: string, checkoutYmd: string) {
  const a = parseYmd(checkinYmd);
  const b = parseYmd(checkoutYmd);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  const nights = Math.round(ms / (24 * 60 * 60 * 1000));
  return Number.isFinite(nights) ? nights : null;
}

/* ------------------ Types ------------------ */

type BookingRequestBody = {
  // Identité
  name?: string;
  email?: string;
  phone?: string;
  message?: string;

  // Séjour
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD

  // Voyageurs
  adults?: number;
  children?: number;

  // Animaux
  animals_count?: number;
  animal_type?: string; // "chien" | "chat" | "autre" | ""
  other_animal_label?: string;

  // Options
  wood_quarters?: number; // nombre de 1/4 de stère
  visitors_count?: number; // nb visiteurs (journée)
  extra_people_count?: number; // nb personnes en + (qui dorment)
  extra_people_nights?: number; // nb nuits facturées pour ces personnes
  early_arrival?: boolean;
  late_departure?: boolean;

  // Calendrier Airbnb (optionnel)
  airbnb_calendar_url?: string;
};

/* ------------------ Pricing (verrouillé) ------------------ */

function computePricing(args: {
  nights: number;
  adults: number;
  animalsCount: number;
  woodQuarters: number;
  visitorsCount: number;
  extraPeopleCount: number;
  extraPeopleNights: number;
  earlyArrival: boolean;
  lateDeparture: boolean;
}) {
  const nights = Math.max(0, safeInt(args.nights, 0));
  const adults = Math.max(0, safeInt(args.adults, 0));

  // Anti-triche : base uniquement depuis env serveur.
  if (BOOKING_BASE_PRICE_PER_NIGHT == null) {
    // On préfère bloquer plutôt que de calculer un total faux / manipulable.
    throw new Error(
      "Configuration manquante : BOOKING_BASE_PRICE_PER_NIGHT. Ajoute-la dans Vercel > Environment Variables puis redeploy."
    );
  }

  const base = Math.round(BOOKING_BASE_PRICE_PER_NIGHT * nights * 100) / 100;

  const cleaning = Math.round((BOOKING_CLEANING_FEE_FIXED ?? 100) * 100) / 100;

  const animalsCount = Math.max(0, safeInt(args.animalsCount, 0));
  const animals =
    animalsCount > 0
      ? Math.round(animalsCount * (BOOKING_ANIMAL_FEE_PER_NIGHT ?? 10) * nights * 100) / 100
      : 0;

  const woodQuarters = Math.max(0, safeInt(args.woodQuarters, 0));
  const wood =
    woodQuarters > 0
      ? Math.round(woodQuarters * (BOOKING_WOOD_PRICE_PER_QUARTER_STERE ?? 40) * 100) / 100
      : 0;

  const visitorsCount = Math.max(0, safeInt(args.visitorsCount, 0));
  const visitors =
    visitorsCount > 0
      ? Math.round(visitorsCount * (BOOKING_VISITOR_FEE_PER_PERSON ?? 50) * 100) / 100
      : 0;

  const extraPeopleCount = Math.max(0, safeInt(args.extraPeopleCount, 0));
  const extraPeopleNights = Math.max(0, safeInt(args.extraPeopleNights, 0));
  const extra_people =
    extraPeopleCount > 0 && extraPeopleNights > 0
      ? Math.round(
          extraPeopleCount * (BOOKING_EXTRA_SLEEPER_FEE_PER_NIGHT ?? 50) * extraPeopleNights * 100
        ) / 100
      : 0;

  const early_arrival = args.earlyArrival ? (BOOKING_EARLY_ARRIVAL_FEE ?? 70) : 0;
  const late_departure = args.lateDeparture ? (BOOKING_LATE_DEPARTURE_FEE ?? 70) : 0;

  const tourist_tax =
    adults > 0 && nights > 0
      ? Math.round(adults * nights * (BOOKING_TOURIST_TAX_PER_ADULT_NIGHT ?? 3.93) * 100) / 100
      : 0;

  const total =
    Math.round(
      (base + cleaning + animals + wood + visitors + extra_people + early_arrival + late_departure + tourist_tax) *
        100
    ) / 100;

  return {
    currency: "EUR",
    base_accommodation: base,
    cleaning,
    animals,
    wood,
    visitors,
    extra_people,
    early_arrival,
    late_departure,
    tourist_tax,
    total,
  };
}

/* ------------------ Moderation signed links ------------------ */

function requireModerationSecret() {
  const s = (BOOKING_MODERATION_SECRET || "").trim();
  if (!s) {
    throw new Error(
      "Missing BOOKING_MODERATION_SECRET. Ajoute-la dans Vercel > Environment Variables puis redeploy."
    );
  }
  return s;
}

function signModeration(params: { id: string; action: "accept" | "reject" | "reply"; exp: number }, secret: string) {
  const msg = `${params.id}.${params.action}.${params.exp}`;
  const sig = createHmac("sha256", secret).update(msg).digest("hex");
  return { ...params, sig };
}

function buildModerationUrl(siteUrl: string, signed: { id: string; action: string; exp: number; sig: string }) {
  const u = new URL("/api/booking-request/moderate", siteUrl);
  u.searchParams.set("id", signed.id);
  u.searchParams.set("action", signed.action);
  u.searchParams.set("exp", String(signed.exp));
  u.searchParams.set("sig", signed.sig);
  return u.toString();
}

/* ------------------ Email templates ------------------ */

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEUR(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function pricingLinesHtml(pricing: any) {
  const lines: { label: string; key: string }[] = [
    { label: "Base hébergement", key: "base_accommodation" },
    { label: "Ménage (fixe)", key: "cleaning" },
    { label: "Animaux", key: "animals" },
    { label: "Bois (poêle)", key: "wood" },
    { label: "Visiteurs (journée)", key: "visitors" },
    { label: "Personnes supplémentaires (nuits)", key: "extra_people" },
    { label: "Arrivée début de journée", key: "early_arrival" },
    { label: "Départ fin de journée", key: "late_departure" },
    { label: "Taxe de séjour", key: "tourist_tax" },
  ];

  const rows = lines
    .map((l) => {
      const v = Number(pricing?.[l.key] || 0);
      if (!Number.isFinite(v) || v <= 0) return "";
      return `<li>${escapeHtml(l.label)} : <b>${escapeHtml(formatEUR(v))}</b></li>`;
    })
    .filter(Boolean)
    .join("");

  return rows ? `<ul style="margin:8px 0 0 18px;padding:0">${rows}</ul>` : "";
}

function buildStamp() {
  // ✅ permet de prouver quel build génère l’email
  const sha =
    (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_REF || "").trim() || "local";
  const env =
    (process.env.VERCEL_ENV || process.env.NODE_ENV || "").trim() || "unknown";
  return { sha, env };
}

function emailAdminHtml(payload: any) {
  const {
    guestName,
    guestEmail,
    guestPhone,
    start_date,
    end_date,
    nights,
    adults,
    children,
    animalsSummary,
    message,
    pricing,
    links,
    contractLink,
    debugReceived, // ✅ ajouté
  } = payload;

  const stamp = buildStamp();

  const debugBlock = debugReceived
    ? `
    <div style="margin-top:14px;padding:10px 12px;border:1px dashed #94a3b8;border-radius:10px;background:#f8fafc">
      <div style="font-weight:700;margin-bottom:6px">DEBUG (valeurs reçues par l’API)</div>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;white-space:pre-wrap">
${escapeHtml(JSON.stringify(debugReceived, null, 2))}
      </div>
    </div>
    `
    : "";

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.45">
    <h2>Nouvelle demande de réservation</h2>
    <p><b>${escapeHtml(guestName)}</b> — ${escapeHtml(guestEmail)} — ${escapeHtml(guestPhone)}</p>

    <p><b>Séjour :</b> ${escapeHtml(start_date)} → ${escapeHtml(end_date)} (${escapeHtml(String(nights))} nuit(s))</p>
    <p><b>Voyageurs :</b> ${escapeHtml(String(adults))} adulte(s) / ${escapeHtml(String(children))} enfant(s)</p>
    <p><b>Animaux :</b> ${escapeHtml(animalsSummary)}</p>

    <p><b>Total estimé (serveur) :</b> ${escapeHtml(formatEUR(Number(pricing.total || 0)))}</p>
    ${pricingLinesHtml(pricing)}

    ${message ? `<p><b>Message :</b><br/>${escapeHtml(message).replaceAll("\n", "<br/>")}</p>` : ""}

    ${debugBlock}

    <hr style="margin:16px 0"/>

    <p style="margin:0 0 10px 0"><b>Actions :</b></p>
    <p style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="${links.accept}" style="background:#16a34a;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">✅ Accepter</a>
      <a href="${links.reject}" style="background:#dc2626;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">❌ Refuser</a>
      <a href="${links.reply}" style="background:#0f172a;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">💬 Répondre</a>
    </p>

    <p style="margin-top:14px">
      Lien contrat (après acceptation) :<br/>
      <a href="${contractLink}">${contractLink}</a>
    </p>

    <p style="color:#64748b;font-size:12px;margin-top:16px">
      Build: <b>${escapeHtml(stamp.env)}</b> — <b>${escapeHtml(stamp.sha)}</b>
      <br/>
      Les liens expirent automatiquement. Ne transférez pas cet email.
    </p>
  </div>
  `;
}

function emailClientHtml(payload: any) {
  const {
    guestName,
    propertyName,
    start_date,
    end_date,
    nights,
    adults,
    children,
    animalsSummary,
    pricing,
    hostName,
  } = payload;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.45">
    <h2>Nous avons bien reçu votre demande — ${escapeHtml(propertyName)}</h2>
    <p>Bonjour ${escapeHtml(guestName)},</p>
    <p>Merci pour votre demande de disponibilité pour <b>${escapeHtml(propertyName)}</b>.</p>

    <p><b>Récapitulatif de votre demande :</b></p>
    <ul style="margin:8px 0 0 18px;padding:0">
      <li>Séjour : <b>${escapeHtml(start_date)} → ${escapeHtml(end_date)}</b> (${escapeHtml(String(nights))} nuit(s))</li>
      <li>Voyageurs : <b>${escapeHtml(String(adults))}</b> adulte(s) / <b>${escapeHtml(String(children))}</b> enfant(s)</li>
      <li>Animaux : <b>${escapeHtml(animalsSummary)}</b></li>
      <li>Estimation : <b>${escapeHtml(formatEUR(Number(pricing.total || 0)))}</b> (estimation, sous réserve de confirmation)</li>
    </ul>

    <p style="margin-top:14px">
      Nous revenons vers vous dès que possible pour confirmer la disponibilité.
    </p>

    <p style="margin-top:14px;color:#0f172a">
      <b>Important :</b> si vous ne recevez pas notre réponse, merci de vérifier votre dossier <b>Courrier indésirable / Spam</b> ainsi que l’onglet <b>Promotions</b> (Gmail).
      Vous pouvez répondre directement à cet e-mail si vous souhaitez compléter votre demande.
    </p>

    <p>Cordialement,<br/>${escapeHtml(hostName)} — ${escapeHtml(propertyName)}</p>
  </div>
  `;
}

/* ------------------ Handler ------------------ */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingRequestBody;

    const guestName = safeStr((body as any).name);
    const guestEmail = safeStr((body as any).email);
    const guestPhone = safeStr((body as any).phone);
    const message = safeStr((body as any).message);

    const start_date = pickDateField(body as any, "start");
    const end_date = pickDateField(body as any, "end");

    // ✅ voyageurs : supporte plusieurs noms si ton form a évolué
    const adults = Math.max(0, pickInt(body as any, ["adults", "adults_count", "adultsCount"], 0));
    const children = Math.max(0, pickInt(body as any, ["children", "children_count", "childrenCount"], 0));

    // Validations minimales
    if (!guestName) return jsonError("Nom obligatoire.", 400);
    if (!guestEmail || !isValidEmail(guestEmail)) return jsonError("Email invalide.", 400);
    if (!start_date || !end_date) return jsonError("Dates obligatoires.", 400);

    const nightsComputed = diffNights(start_date, end_date);
    if (nightsComputed === null) return jsonError("Dates invalides (format attendu : YYYY-MM-DD).", 400);
    if (nightsComputed <= 0)
      return jsonError("Nombre de nuits invalide (date de départ doit être après la date d’arrivée).", 400);

    // ✅ options/animaux : supporte snake_case + camelCase + variantes fréquentes (y compris objets imbriqués via pickFirst)
    const animals_count = Math.max(
      0,
      pickInt(body as any, ["animals_count", "animalsCount", "animals", "pets", "pets_count", "petsCount"], 0)
    );
    const animal_type = safeStr((body as any).animal_type ?? (body as any).animalType ?? "");
    const other_animal_label = safeStr((body as any).other_animal_label ?? (body as any).otherAnimalLabel ?? "");

    const animalsSummary =
      animals_count <= 0
        ? "0"
        : animal_type === "autre" && other_animal_label
          ? `${animals_count} (autre - ${other_animal_label})`
          : `${animals_count} (${animal_type || "—"})`;

    const wood_quarters = Math.max(
      0,
      pickInt(body as any, ["wood_quarters", "woodQuarters", "wood_quarter", "woodQuarter", "wood"], 0)
    );
    const visitors_count = Math.max(
      0,
      pickInt(body as any, ["visitors_count", "visitorsCount", "visitor_count", "visitorCount", "visitors"], 0)
    );
    const extra_people_count = Math.max(
      0,
      pickInt(body as any, ["extra_people_count", "extraPeopleCount", "extra_people", "extraPeople"], 0)
    );
    const extra_people_nights = Math.max(
      0,
      pickInt(body as any, ["extra_people_nights", "extraPeopleNights", "extra_people_night", "extraPeopleNight"], 0)
    );

    const early_arrival = pickBool(body as any, ["early_arrival", "earlyArrival", "early_checkin", "earlyCheckin"]);
    const late_departure = pickBool(body as any, ["late_departure", "lateDeparture", "late_checkout", "lateCheckout"]);

    const pricing = computePricing({
      nights: nightsComputed,
      adults,
      animalsCount: animals_count,
      woodQuarters: wood_quarters,
      visitorsCount: visitors_count,
      extraPeopleCount: extra_people_count,
      extraPeopleNights: extra_people_nights,
      earlyArrival: early_arrival,
      lateDeparture: late_departure,
    });

    // Env indispensables
    const notifyEmail = (BOOKING_NOTIFY_EMAIL || "").trim();
    if (!notifyEmail) {
      return jsonError(
        "Configuration manquante : BOOKING_NOTIFY_EMAIL. Ajoute-la dans Vercel > Environment Variables puis redeploy.",
        500
      );
    }

    const secret = requireModerationSecret();

    // DB insert
    const supabase = requireSupabaseAdmin();

    const insertRow: any = {
      status: "pending",

      name: guestName,
      email: guestEmail,
      phone: guestPhone || null,
      message: message || null,

      start_date,
      end_date,
      nights: nightsComputed,

      adults,
      children,

      animals_count,
      animal_type: animal_type || null,
      other_animal_label: other_animal_label || null,

      wood_quarters: wood_quarters || 0,
      visitors_count: visitors_count || 0,
      extra_people_count: extra_people_count || 0,
      extra_people_nights: extra_people_nights || 0,
      early_arrival: !!early_arrival,
      late_departure: !!late_departure,

      airbnb_calendar_url: safeStr((body as any).airbnb_calendar_url ?? (body as any).airbnbCalendarUrl) || null,

      // ✅ source of truth serveur
      pricing,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("booking_requests")
      .insert(insertRow)
      .select("id")
      .maybeSingle();

    if (insErr) throw new Error(insErr.message || "Erreur insertion Supabase.");
    if (!inserted?.id) throw new Error("Insertion Supabase incomplète (id manquant).");

    const id = String(inserted.id);

    // Liens signés (exp 7 jours)
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const baseUrl = (SITE_URL || "").trim() || "http://localhost:3000";

    const acceptSigned = signModeration({ id, action: "accept", exp }, secret);
    const rejectSigned = signModeration({ id, action: "reject", exp }, secret);
    const replySigned = signModeration({ id, action: "reply", exp }, secret);

    const links = {
      accept: buildModerationUrl(baseUrl, acceptSigned),
      reject: buildModerationUrl(baseUrl, rejectSigned),
      reply: buildModerationUrl(baseUrl, replySigned),
    };

    const contractLink = (() => {
      const u = new URL("/contract", baseUrl);
      u.searchParams.set("rid", id);
      return u.toString();
    })();

    const propertyName =
      (process.env.BOOKING_PROPERTY_NAME || "").trim() ||
      "Superbe bergerie en cœur de forêt – piscine & lac";
    const hostName = (process.env.BOOKING_HOST_NAME || "").trim() || "Coralie";

    // Emails (Resend peut être null si la clé n'est pas configurée)
    const r = resend;
    if (!r) {
      return jsonError(
        "Configuration manquante : RESEND_API_KEY (Resend). Ajoute-la dans Vercel > Environment Variables puis redeploy.",
        500
      );
    }

    // ✅ DEBUG : ce bloc te dira exactement ce que l’API reçoit et calcule
    const debugReceived = {
      received: {
        start_date,
        end_date,
        nights: nightsComputed,
        adults,
        children,
        animals_count,
        animal_type: animal_type || null,
        other_animal_label: other_animal_label || null,
        wood_quarters,
        visitors_count,
        extra_people_count,
        extra_people_nights,
        early_arrival,
        late_departure,
      },
      pricingComputed: pricing,
    };

    await r.emails.send({
      from: RESEND_FROM,
      to: notifyEmail,
      subject: `Nouvelle demande — ${guestName} (${start_date} → ${end_date})`,
      html: emailAdminHtml({
        guestName,
        guestEmail,
        guestPhone,
        start_date,
        end_date,
        nights: nightsComputed,
        adults,
        children,
        animalsSummary,
        message,
        pricing,
        links,
        contractLink,
        debugReceived,
      }),
      replyTo: (BOOKING_REPLY_TO || "").trim() || guestEmail,
    });

    await r.emails.send({
      from: RESEND_FROM,
      to: guestEmail,
      subject: `Nous avons bien reçu votre demande — ${propertyName}`,
      html: emailClientHtml({
        guestName,
        propertyName,
        start_date,
        end_date,
        nights: nightsComputed,
        adults,
        children,
        animalsSummary,
        pricing,
        hostName,
      }),
      replyTo: (BOOKING_REPLY_TO || "").trim() || undefined,
    });

    return NextResponse.json(
      { ok: true, id },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return jsonError(e?.message || "Erreur inconnue.", 500);
  }
}