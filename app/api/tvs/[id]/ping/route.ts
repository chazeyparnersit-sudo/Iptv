import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireRole("tv", "admin", "rrhh", "jefe")
  if (authError) return authError

  const { id } = await params
  const { error } = await supabase
    .from("tvs")
    .update({ lastSeen: new Date().toISOString() })
    .eq("id", Number(id))
  if (error) return NextResponse.json({ error: "tv not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
