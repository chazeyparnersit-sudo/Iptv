import { NextResponse } from "next/server"
import { readDB, resolveAssignment, updateDB } from "@/lib/db"
import { HEARTBEAT_TIMEOUT_MS } from "@/lib/config"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
  const now = Date.now()
  const tvs = db.tvs.map((tv) => {
    const online = tv.lastSeen ? now - new Date(tv.lastSeen).getTime() < HEARTBEAT_TIMEOUT_MS : false
    const resolved = resolveAssignment(db, tv.id)
    return {
      ...tv,
      online,
      current: resolved,
    }
  })
  return NextResponse.json({ tvs })
}

// Rename a TV: { id, name }
export async function POST(req: Request) {
  const body = await req.json()
  const id = Number(body.id)
  const result = await updateDB((db) => {
    const tv = db.tvs.find((t) => t.id === id)
    if (!tv) return null
    if (body.name !== undefined) tv.name = body.name
    if (body.defaultChannel !== undefined) tv.defaultChannel = Number(body.defaultChannel)
    return tv
  })
  if (!result) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ tv: result })
}
