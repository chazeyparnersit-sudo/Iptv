import { NextRequest, NextResponse } from "next/server"
import { readDB } from "@/lib/db"

const MEDIAMTX_BASE = process.env.MEDIAMTX_WEBRTC ?? "http://127.0.0.1:8889"
const ALLOWED_ORIGINS = new Set([
  "https://iptv-local-chazey.duckdns.org",
  "http://134.209.220.194:3000",
])

function getAllowedOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin") ?? ""
  return ALLOWED_ORIGINS.has(origin) ? origin : "https://iptv-local-chazey.duckdns.org"
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  const { canal } = await params

  const db = await readDB()
  const validPaths = new Set(db.channels.map((c: { mediamtxPath: string }) => c.mediamtxPath))
  if (!validPaths.has(canal)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 404 })
  }

  const body = await req.text()
  const upstream = await fetch(`${MEDIAMTX_BASE}/${canal}/whep`, {
    method: "POST",
    headers: { "Content-Type": req.headers.get("Content-Type") || "application/sdp" },
    body,
  })
  const responseBody = await upstream.text()
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/sdp",
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
      "Location": upstream.headers.get("Location") || "",
      "Vary": "Origin",
    },
  })
}
