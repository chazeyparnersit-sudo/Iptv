import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError

  const { id } = await params
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

  const { data: current, error: fetchError } = await supabase
    .from("users")
    .select("tokenVersion")
    .eq("id", id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ tokenVersion: (current.tokenVersion ?? 0) + 1 })
    .eq("id", id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
