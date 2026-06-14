import { NextResponse } from "next/server"
import { updateDB } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tvId = Number(id)
  const ok = await updateDB((db) => {
    const tv = db.tvs.find((t) => t.id === tvId)
    if (!tv) return false
    tv.lastSeen = new Date().toISOString()
    return true
  })
  if (!ok) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
