import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"
import type { SourceType } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError
  const { id } = await params
  const channelId = Number(id)
  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.sourceType !== undefined) update.sourceType = body.sourceType as SourceType
  if (body.sourceUrl !== undefined) update.sourceUrl = body.sourceUrl
  if (body.content !== undefined) update.content = body.content
  if (body.bgColor !== undefined) update.bgColor = body.bgColor
  if (body.textColor !== undefined) update.textColor = body.textColor
  const { data, error } = await supabase.from('channels').update(update).eq('id', channelId).select().single()
  if (error) return NextResponse.json({ error: "channel not found" }, { status: 404 })
  return NextResponse.json({ channel: data })
}
