import { NextResponse } from "next/server"
import { readDB, resolveAssignment, updateDB } from "@/lib/db"
import type { Override, SourceType } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tv = Number(searchParams.get("tv"))
  if (!tv) return NextResponse.json({ error: "missing tv" }, { status: 400 })

  const db = await readDB()
  const resolved = resolveAssignment(db, tv)
  if (!resolved) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json(resolved)
}

// Assign TV N -> channel M, or set a direct content override
export async function POST(req: Request) {
  const body = await req.json()
  const tvId = Number(body.tvId ?? body.tv)
  if (!tvId) return NextResponse.json({ error: "missing tvId" }, { status: 400 })

  const sourceType = body.sourceType as SourceType | undefined

  const result = await updateDB((db) => {
    const tv = db.tvs.find((t) => t.id === tvId)
    if (!tv) return null

    if (!sourceType || sourceType === "LIVE") {
      // Plain live channel assignment clears any override
      const channelId = Number(body.channel ?? body.channelId)
      if (channelId) tv.channel = channelId
      tv.override = null
    } else {
      const override: Override = {
        sourceType,
        channelId: body.channelId ? Number(body.channelId) : undefined,
        sourceUrl: body.sourceUrl,
        content: body.content,
        bgColor: body.bgColor,
        textColor: body.textColor,
      }
      tv.override = override
    }
    return resolveAssignment(db, tvId)
  })

  if (!result) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json(result)
}
