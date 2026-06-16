import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function POST() {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError

  const { data: tvs } = await supabase.from("tvs").select("id, defaultChannel")
  await Promise.all((tvs ?? []).map(t =>
    supabase.from("tvs").update({ channel: t.defaultChannel, override: null }).eq("id", t.id)
  ))
  await supabase.from("schedule").delete().neq("id", "")

  return NextResponse.json({ ok: true })
}
