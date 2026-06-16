import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const MEDIAMTX_BASE = process.env.MEDIAMTX_WEBRTC ?? "http://127.0.0.1:8889"

// Cache de canales válidos — evita query a Supabase en cada conexión WHEP
let validPathsCache: Set<string> | null = null
let cacheExpiry = 0
async function getValidPaths(): Promise<Set<string>> {
  if (validPathsCache && Date.now() < cacheExpiry) return validPathsCache
  const { data } = await supabase.from("channels").select("mediamtxPath")
  validPathsCache = new Set((data ?? []).map((c: { mediamtxPath: string }) => c.mediamtxPath))
  cacheExpiry = Date.now() + 60000
  return validPathsCache
}
const ALLOWED_ORIGINS = new Set([
  "https://iptv-local-chazey.duckdns.org",
  "http://134.209.220.194:3000",
])

function getAllowedOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin") ?? ""
  return ALLOWED_ORIGINS.has(origin) ? origin : "https://iptv-local-chazey.duckdns.org"
}


function patchSDP(sdp: string): string {
  if (!sdp.startsWith("v=")) return sdp
  const lines = sdp.split("\r\n").filter(Boolean)
  const out: string[] = []
  let extmapId = 14
  let inVideo = false
  let playoutInjected = false
  for (const line of lines) {
    if (line.startsWith("m=video")) { inVideo = true; playoutInjected = false }
    if (line.startsWith("m=audio")) inVideo = false
    // Inyectar playout-delay justo antes de a=sendonly en la sección video
    if (inVideo && !playoutInjected && line === "a=sendonly") {
      out.push(`a=extmap:${extmapId} urn:ietf:params:rtp-hdrext:playout-delay`)
      playoutInjected = true
    }
    out.push(line)
  }
  return out.join("\r\n") + "\r\n"
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

  const validPaths = await getValidPaths()
  if (!validPaths.has(canal)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 404 })
  }

  const body = await req.text()
  let upstream: Response
  try {
    upstream = await fetch(`${MEDIAMTX_BASE}/${canal}/whep`, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("Content-Type") || "application/sdp" },
      body,
    })
  } catch {
    return NextResponse.json({ error: "MediaMTX no disponible" }, { status: 502 })
  }
  const responseBody = await upstream.text()
  const patchedSDP = patchSDP(responseBody)
  return new NextResponse(patchedSDP, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/sdp",
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
      "Location": upstream.headers.get("Location") || "",
      "Vary": "Origin",
    },
  })
}
