// src/app/api/contract/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Contract API not implemented yet" },
    { status: 501 }
  );
}
