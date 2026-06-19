import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { whipUrl } from "@/lib/config"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const db = await readDB()
  const channels = db.channels.map((c) => ({
    ...c,
    whipUrl: whipUrl(c.mediamtxPath),
  }))
  return NextResponse.json({ channels })
}
