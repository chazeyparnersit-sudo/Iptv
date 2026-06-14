import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { whipUrl } from "@/lib/config"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
  const channels = db.channels.map((c) => ({
    ...c,
    whipUrl: whipUrl(c.mediamtxPath),
  }))
  return NextResponse.json({ channels })
}
