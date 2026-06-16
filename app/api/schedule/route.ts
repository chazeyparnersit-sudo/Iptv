import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import type { ScheduleItem } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
  return NextResponse.json({ schedule: db.schedule })
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const body = await req.json()
  const item: ScheduleItem = {
    id: randomUUID(),
    tvIds: (body.tvIds ?? []).map(Number),
    sourceType: body.sourceType,
    channelId: body.channelId ? Number(body.channelId) : undefined,
    sourceUrl: body.sourceUrl,
    content: body.content,
    bgColor: body.bgColor,
    textColor: body.textColor,
    startTime: body.startTime ?? "",
    endTime: body.endTime ?? "",
  }
  const { error } = await supabase.from('schedule').insert(item)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item })
}

export async function DELETE(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const { error } = await supabase.from('schedule').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
