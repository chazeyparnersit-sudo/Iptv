import { NextResponse } from "next/server"
import { resolveAssignment } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import { z } from "zod"
import { sourceUrlSchema } from "@/lib/schemas"
import type { Override, SourceType, TV } from "@/lib/types"

const SOURCE_TYPES = ["LIVE", "CANVA", "ANNOUNCEMENT", "VIDEO_LOOP", "PDF", "IMAGE_SLIDES"] as const

const assignmentPostSchema = z.object({
  tvId: z.number().optional(),
  tv: z.number().optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  channelId: z.number().optional(),
  channel: z.number().optional(),
  sourceUrl: sourceUrlSchema.optional(),
  content: z.string().optional(),
  bgColor: z.string().optional(),
  textColor: z.string().optional(),
})

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
  const rawBody = await req.json()
  const parsed = assignmentPostSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data
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
