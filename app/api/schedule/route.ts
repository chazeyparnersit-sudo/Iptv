import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import type { ScheduleItem } from "@/lib/types"
import { schedulePostSchema } from "@/lib/schemas"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const db = await readDB()
  return NextResponse.json({ schedule: db.schedule })
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const parsed = schedulePostSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data
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
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 })
  }
  const { error } = await supabase.from('schedule').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
