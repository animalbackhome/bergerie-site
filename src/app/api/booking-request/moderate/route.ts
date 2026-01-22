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

  const now = Math.floor(Date.now() / 1000);
  if (expNum < now) return false;

  const msg = `${params.id}.${params.action}.${params.exp}`;
  const expected = createHmac("sha256", BOOKING_MODERATION_SECRET).update(msg).digest("hex");
  return expected === params.sig;
}

function redirectTo(origin: string, path: string) {
  const res = NextResponse.redirect(new URL(path, origin), 302);
  // évite qu’un webmail “cache” une ancienne réponse
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const id = url.searchParams.get("id") || "";
  const action = url.searchParams.get("action") || "";
  const exp = url.searchParams.get("exp") || "";
  const sig = url.searchParams.get("sig") || "";

  // Si lien incomplet ou invalide/expiré → on redirige vers "refused" (simple et propre)
  if (!id || !action || !exp || !sig) {
    return redirectTo(origin, "/booking/refused");
  }
  if (!verifySig({ id, action, exp, sig })) {
    return redirectTo(origin, "/booking/refused");
  }

  if (action === "accept") {
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "accepted", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return redirectTo(origin, "/booking/refused");
    }
    return redirectTo(origin, "/booking/accepted");
  }

  if (action === "reject") {
    const { error } = await supabaseAdmin
      .from("booking_requests")
      .update({ status: "refused", moderated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return redirectTo(origin, "/booking/refused");
    }
    return redirectTo(origin, "/booking/refused");
  }

  if (action === "reply") {
    // “Répondre” = ne change pas le statut, juste une page d’info.
    return redirectTo(origin, "/booking/reply");
  }

  return redirectTo(origin, "/booking/refused");
}
