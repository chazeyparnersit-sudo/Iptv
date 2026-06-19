import { NextResponse } from "next/server"
import { resolveAssignment } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import type { Override, SourceType, TV } from "@/lib/types"

export const dynamic = "force-dynamic"

// --- Cache en memoria para datos compartidos (channels + schedule) ---
const CACHE_TTL_MS = 5000
let cachedShared: { channels: any[]; schedule: any[]; ts: number } | null = null

async function getSharedData() {
  const now = Date.now()
  if (cachedShared && now - cachedShared.ts < CACHE_TTL_MS) {
    return cachedShared
  }
  const [channelsRes, scheduleRes] = await Promise.all([
    supabase.from("channels").select("*"),
    supabase.from("schedule").select("*"),
  ])
  cachedShared = {
    channels: channelsRes.data ?? [],
    schedule: scheduleRes.data ?? [],
    ts: now,
  }
  return cachedShared
}

export async function GET(req: Request) {
  const { error: authError } = await requireRole("tv", "admin", "rrhh", "jefe")
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const tv = Number(searchParams.get("tv"))
  if (!tv) return NextResponse.json({ error: "missing tv" }, { status: 400 })

  // Fire-and-forget: no bloquea la respuesta
  supabase
    .from("tvs")
    .update({ lastSeen: new Date().toISOString() })
    .eq("id", tv)
    .then(() => {})

  const [tvRes, shared] = await Promise.all([
    supabase.from("tvs").select("*").eq("id", tv).single(),
    getSharedData(),
  ])

  if (!tvRes.data) return NextResponse.json({ error: "tv not found" }, { status: 404 })

  const db = {
    tvs: [tvRes.data],
    channels: shared.channels,
    schedule: shared.schedule,
  }

  const resolved = resolveAssignment(db as any, tv)
  if (!resolved) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json(resolved)
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const body = await req.json()
  const tvId = Number(body.tvId ?? body.tv)
  if (!tvId) return NextResponse.json({ error: "missing tvId" }, { status: 400 })
  const sourceType = body.sourceType as SourceType | undefined
  let update: Pick<Partial<TV>, "channel" | "override"> = {}
  if (!sourceType || sourceType === "LIVE") {
    const channelId = Number(body.channel ?? body.channelId)
    if (channelId) update.channel = channelId
    update.override = null
  } else {
    const override: Override = {
      sourceType,
      channelId: body.channelId ? Number(body.channelId) : undefined,
      sourceUrl: body.sourceUrl,
      content: body.content,
      bgColor: body.bgColor,
      textColor: body.textColor,
    }
    update.override = override
  }
  await supabase.from("tvs").update(update).eq("id", tvId)

  const [tvRes, shared] = await Promise.all([
    supabase.from("tvs").select("*").eq("id", tvId).single(),
    getSharedData(),
  ])

  if (!tvRes.data) return NextResponse.json({ error: "tv not found" }, { status: 404 })

  const db = {
    tvs: [tvRes.data],
    channels: shared.channels,
    schedule: shared.schedule,
  }

  const resolved = resolveAssignment(db as any, tvId)
  if (!resolved) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json(resolved)
}
