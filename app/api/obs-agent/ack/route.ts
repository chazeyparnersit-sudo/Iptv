import { NextResponse } from "next/server"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { requireAgentToken } from "@/lib/agent-auth"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  agentId: z.string().min(1),
  result: z.string().min(1).max(500),
})

export async function POST(req: Request) {
  const { error: authError } = await requireAgentToken(req)
  if (authError) return authError

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { agentId, result } = parsed.data

  const { error } = await supabase
    .from("obs_agents")
    .update({
      pendingCommand: null,
      lastResult: result,
      lastResultAt: new Date().toISOString(),
    })
    .eq("id", agentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
