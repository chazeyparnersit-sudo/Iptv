import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { requireAgentToken } from "@/lib/agent-auth"

export const dynamic = "force-dynamic"

// El agente manda su propio id (lo trae en su config local) — no inventa ni
// registra agentes nuevos solo, deben existir previamente en la tabla
// obs_agents (insertados a mano una vez, ver migración SQL).
export async function GET(req: Request) {
  const { error: authError } = await requireAgentToken(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get("agentId")
  if (!agentId) return NextResponse.json({ error: "missing agentId" }, { status: 400 })

  const { data: current } = await supabase
    .from("obs_agents")
    .select("pendingCommand")
    .eq("id", agentId)
    .single()

  // Heartbeat: registra que el agente sigue vivo, sin bloquear la respuesta.
  supabase
    .from("obs_agents")
    .update({ lastSeen: new Date().toISOString() })
    .eq("id", agentId)
    .then(() => {})

  return NextResponse.json({ pendingCommand: current?.pendingCommand ?? null })
}
