import { NextResponse } from "next/server"
import { updateDB } from "@/lib/db"

export const dynamic = "force-dynamic"

// Reset all TVs to their default live channels
export async function POST() {
  await updateDB((db) => {
    for (const tv of db.tvs) {
      tv.channel = tv.defaultChannel
      tv.override = null
    }
    db.schedule = []
  })
  return NextResponse.json({ ok: true })
}
