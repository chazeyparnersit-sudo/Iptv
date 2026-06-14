import { NextResponse } from "next/server"
import { updateDB } from "@/lib/db"

export const dynamic = "force-dynamic"

// Reset TV N to its default live channel: ?tv=N
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const tvId = Number(searchParams.get("tv"))
  if (!tvId) return NextResponse.json({ error: "missing tv" }, { status: 400 })

  const ok = await updateDB((db) => {
    const tv = db.tvs.find((t) => t.id === tvId)
    if (!tv) return false
    tv.channel = tv.defaultChannel
    tv.override = null
    // Remove this TV from any scheduled items
    db.schedule = db.schedule
      .map((s) => ({ ...s, tvIds: s.tvIds.filter((id) => id !== tvId) }))
      .filter((s) => s.tvIds.length > 0)
    return true
  })
  if (!ok) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
