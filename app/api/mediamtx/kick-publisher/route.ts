import { NextResponse } from "next/server"
import { MEDIAMTX_API_BASE } from "@/lib/config"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError
  try {
    const body = await req.json()
    const channelPath = body?.channelPath
    if (!channelPath || typeof channelPath !== "string") {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${MEDIAMTX_API_BASE}/v3/paths/kick/${encodeURIComponent(channelPath)}`, {
      method: "DELETE",
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)
    return NextResponse.json({ success: res.ok })
  } catch {
    return NextResponse.json({ success: false })
  }
}
