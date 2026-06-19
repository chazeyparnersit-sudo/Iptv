import { NextResponse } from "next/server"
import { getSession } from "./auth"
import { supabase } from "./supabase"
import type { UserRole } from "./types"

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession()
  if (!session || !roles.includes(session.role)) {
    const who = session?.username ?? "anonymous"
    const role = session?.role ?? "none"
    console.warn(`[auth] DENIED user=${who} role=${role} required=${roles.join(",")} ts=${new Date().toISOString()}`)
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null }
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("tokenVersion")
    .eq("id", session.id)
    .single()

  if (!userRow || userRow.tokenVersion !== session.tokenVersion) {
    console.warn(`[auth] REVOKED user=${session.username} role=${session.role} ts=${new Date().toISOString()}`)
    return { error: NextResponse.json({ error: "Sesión revocada" }, { status: 401 }), session: null }
  }

  return { error: null, session }
}
