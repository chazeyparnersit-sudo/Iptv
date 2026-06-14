import { NextResponse } from "next/server"
import { updateDB } from "@/lib/db"
import type { SourceType } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const channelId = Number(id)
  const body = await req.json()

  const result = await updateDB((db) => {
    const channel = db.channels.find((c) => c.id === channelId)
    if (!channel) return null
    if (body.name !== undefined) channel.name = body.name
    if (body.sourceType !== undefined) channel.sourceType = body.sourceType as SourceType
    if (body.sourceUrl !== undefined) channel.sourceUrl = body.sourceUrl
    if (body.content !== undefined) channel.content = body.content
    if (body.bgColor !== undefined) channel.bgColor = body.bgColor
    if (body.textColor !== undefined) channel.textColor = body.textColor
    return channel
  })

  if (!result) return NextResponse.json({ error: "channel not found" }, { status: 404 })
  return NextResponse.json({ channel: result })
}
