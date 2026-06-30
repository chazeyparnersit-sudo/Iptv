import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

const ONLINE_TIMEOUT_MS = 15000

export async function GET() {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError

  const { data: agents } = await supabase.from("obs_agents").select("*").order("id")
  const now = Date.now()
  const withStatus = (agents ?? []).map((a) => ({
    ...a,
    online: a.lastSeen ? now - new Date(a.lastSeen).getTime() < ONLINE_TIMEOUT_MS : false,
  }))
  return NextResponse.json({ agents: withStatus })
}
