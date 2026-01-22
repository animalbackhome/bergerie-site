// src/app/api/contract/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Contract API placeholder (OK)" },
    { status: 200 }
  );
}

// redeploy trigger
