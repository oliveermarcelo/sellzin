// Next.js API route — proxy for tracking pixel
// Allows the JS snippet to POST to https://crm-domain.com/api/track
// instead of https://crm-domain.com:3001/v1/track (blocked by SSL/nginx)

import { NextRequest, NextResponse } from "next/server";

const FASTIFY_BASE = process.env.INTERNAL_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${FASTIFY_BASE}/v1/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
