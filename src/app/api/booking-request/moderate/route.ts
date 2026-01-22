// src/app/api/booking-request/moderate/route.ts
import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function envOrNull(name: string) {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

const BOOKING_MODERATION_SECRET = envOrNull("BOOKING_MODERATION_SECRET");

function verifySig(params: { id: string; action: string; exp: string; sig: string }) {
  if (!BOOKING_MODERATION_SECRET) return false;

  const expNum = Number(params.exp);
  if (!Number.isFinite(expNum)) return false;

  // expiration
  const now = Math.floor(Date.now() / 1000);
  if (expNum < now) return false;

  const msg = `${params.id}.${params.action}.${params.exp}`;
  const expected = createHmac("sha256", BOOKING_MODERATION_SECRET).update(msg).digest("hex");
  return expected === params.sig;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const action = url.searchParams.get("action") || "";
  const exp = url.searchParams.get("exp") || "";
  const sig = url.searchParams.get("sig") || "";

  // base du site (origin)
  const origin = url.origin;

  if (!id || !action || !exp || !sig) {
    // page simple si lien incomplet
    return NextResponse.redirect(new URL("/booking/refused", origin), 302);
  }

  if (!verifySig({ id, action, exp, sig })) {
    // lien invalide/expiré -> page refused (on pourrait faire une page "expired" plus tard)
    return NextResponse.redirect(new URL("/booking/refused", origin), 302);
  }

  // Action -> update DB si besoin, puis redirect vers une page propre
  if (action === "accept") {
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "accepted", moderated_at: new Date().toISOString() })
      .eq("id", id);

    // même si erreur, on redirige vers refused (ça évite du JSON blanc)
    if (error) return NextResponse.redirect(new URL("/booking/refused", origin), 302);

    return NextResponse.redirect(new URL("/booking/accepted", origin), 302);
  }

  if (action === "reject") {
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "refused", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.redirect(new URL("/booking/refused", origin), 302);

    return NextResponse.redirect(new URL("/booking/refused", origin), 302);
  }

  if (action === "reply") {
    // “Répondre” = on ne change pas le statut
    return NextResponse.redirect(new URL("/booking/reply", origin), 302);
  }

  return NextResponse.redirect(new URL("/booking/refused", origin), 302);
}
