import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { readDB, updateDB } from "@/lib/db"
import type { ScheduleItem } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = await readDB()
  return NextResponse.json({ schedule: db.schedule })
}

export async function POST(req: Request) {
  const body = await req.json()
  const item: ScheduleItem = {
    id: randomUUID(),
    tvIds: (body.tvIds ?? []).map(Number),
    sourceType: body.sourceType,
    channelId: body.channelId ? Number(body.channelId) : undefined,
    sourceUrl: body.sourceUrl,
    content: body.content,
    bgColor: body.bgColor,
    textColor: body.textColor,
    startTime: body.startTime ?? "",
    endTime: body.endTime ?? "",
  }
  await updateDB((db) => {
    db.schedule.push(item)
  })
  return NextResponse.json({ item })
}

// Cancel a scheduled item: ?id=uuid
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  await updateDB((db) => {
    db.schedule = db.schedule.filter((s) => s.id !== id)
  })
  return NextResponse.json({ ok: true })
}
