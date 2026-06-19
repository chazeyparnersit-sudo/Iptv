import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError
  const { searchParams } = new URL(req.url)
  const tvId = Number(searchParams.get("tv"))
  if (!tvId) return NextResponse.json({ error: "missing tv" }, { status: 400 })
  const db = await readDB()
  const tv = db.tvs.find((t) => t.id === tvId)
  if (!tv) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  const affected = db.schedule.filter(s => s.tvIds.includes(tvId))

  const results = await Promise.all([
    supabase.from('tvs').update({ channel: tv.defaultChannel, override: null }).eq('id', tvId),
    ...affected.map(s => {
      const newIds = s.tvIds.filter(id => id !== tvId)
      return newIds.length === 0
        ? supabase.from('schedule').delete().eq('id', s.id)
        : supabase.from('schedule').update({ tvIds: newIds }).eq('id', s.id)
    })
  ])

  const failed = results.filter(r => r.error)
  if (failed.length > 0) {
    console.error('[reset] errores parciales:', failed.map(r => r.error))
    return NextResponse.json({ error: 'reset parcialmente fallido', details: failed.map(r => r.error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
