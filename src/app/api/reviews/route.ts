import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resend,
  RESEND_FROM,
  REVIEWS_NOTIFY_EMAIL,
  SITE_URL,
  REVIEWS_MODERATION_SECRET,
} from "@/lib/resendServer";
import { createHmac } from "crypto";

type Payload = {
  name?: string;
  email?: string;
  message?: string;
  rating?: number;
};

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signModerationLink(params: { id: string; action: "approve" | "reject"; exp: number }) {
  if (!REVIEWS_MODERATION_SECRET) return null;
  const msg = `${params.id}.${params.action}.${params.exp}`;
  const sig = createHmac("sha256", REVIEWS_MODERATION_SECRET).update(msg).digest("hex");
  const url = new URL("/api/reviews/moderate", SITE_URL);
  url.searchParams.set("id", params.id);
  url.searchParams.set("action", params.action);
  url.searchParams.set("exp", String(params.exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("reviews_public")
    .select("id, created_at, name, date_label, text, rating")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reviews: data ?? [] });
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
  const message = (body.message || "").trim();
  const rating = Number.isFinite(body.rating) ? Number(body.rating) : 5;

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Missing name/email/message" }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: "Rating must be 1..5" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews_pending")
    .insert({
      name,
      email,
      message,
      rating,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Email admin
  if (REVIEWS_NOTIFY_EMAIL) {
    try {
      const id = data.id as string;

      // Liens signés (expire dans 7 jours)
      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const approveUrl = signModerationLink({ id, action: "approve", exp });
      const rejectUrl = signModerationLink({ id, action: "reject", exp });

      const plainText =
        `Un nouvel avis est en attente de validation:\n\n` +
        `Nom: ${name}\nEmail: ${email}\nNote: ${rating}/5\n\nMessage:\n${message}\n\n` +
        `ID: ${id}\n` +
        (approveUrl && rejectUrl
          ? `\nValider: ${approveUrl}\nRefuser: ${rejectUrl}\n`
          : `\n(⚠️ Liens de modération désactivés: variable REVIEWS_MODERATION_SECRET manquante)\n`);

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.4">
          <h2 style="margin:0 0 12px">Nouvel avis en attente</h2>
          <p style="margin:0 0 10px"><b>Nom:</b> ${escapeHtml(name)}<br/>
            <b>Email:</b> ${escapeHtml(email)}<br/>
            <b>Note:</b> ${rating}/5</p>
          <p style="margin:0 0 8px"><b>Message :</b></p>
          <div style="white-space:pre-wrap;background:#0b1220;color:#e5e7eb;padding:12px;border-radius:10px">
            ${escapeHtml(message)}
          </div>
          <p style="margin:12px 0 10px;color:#6b7280;font-size:12px">ID: ${escapeHtml(id)}</p>

          ${
            approveUrl && rejectUrl
              ? `
              <div style="display:flex;gap:10px;margin-top:12px">
                <a href="${approveUrl}" style="background:#16a34a;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block">✅ Valider</a>
                <a href="${rejectUrl}" style="background:#dc2626;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block">❌ Refuser</a>
              </div>
              <p style="margin:10px 0 0;color:#6b7280;font-size:12px">Les liens expirent dans 7 jours.</p>
              `
              : `
              <p style="margin-top:12px;color:#b45309">
                ⚠️ Liens de modération désactivés : variable <code>REVIEWS_MODERATION_SECRET</code> manquante.
              </p>
              `
          }
        </div>
      `;

      await resend.emails.send({
        from: RESEND_FROM,
        to: REVIEWS_NOTIFY_EMAIL,
        subject: "Nouvel avis en attente (bergerie-site)",
        text: plainText,
        html,
      });
    } catch (e) {
      console.warn("Resend send failed:", e);
    }
  }

  return NextResponse.json({ ok: true, id: data.id });
}
