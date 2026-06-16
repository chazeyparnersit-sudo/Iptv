import { NextResponse } from "next/server"
import { readDB, resolveAssignment } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import { HEARTBEAT_TIMEOUT_MS } from "@/lib/config"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
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
  const body = await req.json()
  const id = Number(body.id)
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.defaultChannel !== undefined) update.defaultChannel = Number(body.defaultChannel)
  const { data, error } = await supabase.from('tvs').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ tv: data })
}
