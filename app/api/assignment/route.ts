import { NextResponse } from "next/server"
import { readDB, resolveAssignment } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import type { Override, SourceType } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { error: authError } = await requireRole("tv", "admin", "rrhh", "jefe")
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const tv = Number(searchParams.get("tv"))
  if (!tv) return NextResponse.json({ error: "missing tv" }, { status: 400 })
  const db = await readDB()
  await supabase.from('tvs').update({ lastSeen: new Date().toISOString() }).eq('id', tv)
  const resolved = resolveAssignment(db, tv)
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
  let update: any = {}
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
  await supabase.from('tvs').update(update).eq('id', tvId)
  const db = await readDB()
  const resolved = resolveAssignment(db, tvId)
  if (!resolved) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json(resolved)
}
