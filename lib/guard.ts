import { NextResponse } from "next/server"
import { getSession } from "./auth"
import type { UserRole } from "./types"

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession()
  if (!session || !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null }
  }
  return { error: null, session }
}
