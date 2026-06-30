import { NextResponse } from "next/server"
import { readAssignmentDB, resolveAssignment } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import { HEARTBEAT_TIMEOUT_MS } from "@/lib/config"
import { tvsPatchSchema } from "@/lib/schemas"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const db = await readAssignmentDB()
  const now = Date.now()
  const tvs = db.tvs.map((tv) => {
    const online = tv.lastSeen ? now - new Date(tv.lastSeen).getTime() < HEARTBEAT_TIMEOUT_MS : false
    const resolved = resolveAssignment(db, tv.id)
    return { ...tv, online, current: resolved }
  })
  return NextResponse.json({ tvs })
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh")
  if (authError) return authError
  const parsed = tvsPatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { id, name, defaultChannel, volume } = parsed.data
  const update: Partial<{name: string, defaultChannel: number, volume: number}> = {}
  if (name !== undefined) update.name = name
  if (defaultChannel !== undefined) update.defaultChannel = defaultChannel
  if (volume !== undefined) update.volume = volume
  const { data, error } = await supabase.from('tvs').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ tv: data })
}
