import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = {
  id?: string;
  action?: "approve" | "reject";
};

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = (body.id || "").trim();
  const action = body.action;

  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { ok: false, error: "Missing id or invalid action" },
      { status: 400 }
    );
  }

  // 1) Récupérer l'avis pending
  const { data: pending, error: pendingErr } = await supabaseAdmin
    .from("reviews_pending")
    .select("id, created_at, name, message, rating, status")
    .eq("id", id)
    .single();

  if (pendingErr || !pending) {
    return NextResponse.json({ ok: false, error: "Review not found" }, { status: 404 });
  }

  // 2) Si reject : on garde l'historique -> status = rejected
  if (action === "reject") {
    const { error: updErr } = await supabaseAdmin
      .from("reviews_pending")
      .update({ status: "rejected" })
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // 3) Si approve : publier dans reviews_public + status = approved
  const dateLabel = new Date(pending.created_at).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const { error: insErr } = await supabaseAdmin.from("reviews_public").insert({
    name: pending.name,
    date_label: dateLabel,
    text: pending.message,
    rating: pending.rating,
  });

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("reviews_pending")
    .update({ status: "approved" })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "approved" });
}
