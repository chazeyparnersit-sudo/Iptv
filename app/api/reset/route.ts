import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const tvId = Number(searchParams.get("tv"))
  if (!tvId) return NextResponse.json({ error: "missing tv" }, { status: 400 })

  const db = await readDB()
  const tv = db.tvs.find((t) => t.id === tvId)
  if (!tv) return NextResponse.json({ error: "tv not found" }, { status: 404 })

  // Reset TV a canal por defecto
  await supabase.from('tvs').update({ channel: tv.defaultChannel, override: null }).eq('id', tvId)

  // Quitar esta TV de los schedules activos
  const affected = db.schedule.filter(s => s.tvIds.includes(tvId))
  for (const s of affected) {
    const newIds = s.tvIds.filter(id => id !== tvId)
    if (newIds.length === 0) {
      await supabase.from('schedule').delete().eq('id', s.id)
    } else {
      await supabase.from('schedule').update({ tvIds: newIds }).eq('id', s.id)
    }
  }

  return NextResponse.json({ ok: true })
}
