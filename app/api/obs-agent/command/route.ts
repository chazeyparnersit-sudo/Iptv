import { NextResponse } from "next/server"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

// Whitelist estricta — nunca se acepta un comando arbitrario desde el
// cliente. Esto es lo único que el agente sabrá ejecutar.
const COMMANDS = ["stop_stream", "sleep", "stop_and_sleep"] as const

const bodySchema = z.object({
  agentId: z.string().min(1),
  command: z.enum(COMMANDS),
})

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { agentId, command } = parsed.data

  const { data, error } = await supabase
    .from("obs_agents")
    .update({
      pendingCommand: command,
      commandIssuedAt: new Date().toISOString(),
      lastResult: null,
      lastResultAt: null,
    })
    .eq("id", agentId)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 })
  return NextResponse.json({ agent: data })
}
