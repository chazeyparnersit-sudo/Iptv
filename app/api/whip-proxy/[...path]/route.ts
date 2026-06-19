import { NextRequest, NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { requireRole } from "@/lib/guard"

const MEDIAMTX_BASE = process.env.MEDIAMTX_WEBRTC ?? "http://127.0.0.1:8889"
const ALLOWED_ORIGINS = new Set([
  "https://iptv-local-chazey.duckdns.org",
  "http://134.209.220.194:3000",
])

// Devuelve el origin solo si está en la whitelist. null = no se agrega el header
// Access-Control-Allow-Origin, dejando que el navegador bloquee la respuesta por CORS
// en vez de devolver un origin "de fallback" que no corresponde al request real.
function getAllowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin") ?? ""
  return ALLOWED_ORIGINS.has(origin) ? origin : null
}

function corsHeaders(req: NextRequest, extra: Record<string, string>): Record<string, string> {
  const origin = getAllowedOrigin(req)
  return origin ? { ...extra, "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : extra
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req, {
      "Access-Control-Allow-Methods": "POST, OPTIONS, PATCH, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    }),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError

  const { path } = await params
  const pathStr = path.join("/")
  const db = await readDB()
  const validPaths = new Set(db.channels.map((c: { mediamtxPath: string }) => c.mediamtxPath))
  if (!validPaths.has(pathStr)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 404 })
  }
  const body = await req.arrayBuffer()
  const upstream = await fetch(`${MEDIAMTX_BASE}/${pathStr}/whip`, {
    method: "POST",
    headers: { "Content-Type": req.headers.get("Content-Type") || "application/sdp" },
    body,
  })
  const resBody = await upstream.arrayBuffer()
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: corsHeaders(req, {
      "Content-Type": upstream.headers.get("Content-Type") || "application/sdp",
      "Location": upstream.headers.get("Location") || "",
    }),
  })
}
