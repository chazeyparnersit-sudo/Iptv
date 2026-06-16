import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabase
    .from("tvs")
    .update({ lastSeen: new Date().toISOString() })
    .eq("id", Number(id))
  if (error) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
