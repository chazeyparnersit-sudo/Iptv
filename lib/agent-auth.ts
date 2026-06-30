import { NextResponse } from "next/server"

// El agente que corre en el portátil con OBS no es un usuario con sesión de
// navegador — es un script en background. Usa un secreto propio (generado
// una sola vez, guardado en OBS_AGENT_TOKEN en .env.local del servidor Y en
// la config local del agente) en vez del sistema de JWT/cookies de usuarios.
export function requireAgentToken(req: Request) {
  const expected = process.env.OBS_AGENT_TOKEN
  if (!expected || expected.length < 16) {
    return {
      error: NextResponse.json({ error: "OBS_AGENT_TOKEN no configurado en el servidor" }, { status: 500 }),
    }
  }
  const got = req.headers.get("x-agent-token")
  if (!got || got !== expected) {
    return { error: NextResponse.json({ error: "Token de agente inválido" }, { status: 401 }) }
  }
  return { error: null }
}
