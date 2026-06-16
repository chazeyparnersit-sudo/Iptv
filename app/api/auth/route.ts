import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB } from "@/lib/db"
import { createSession, deleteSession } from "@/lib/auth"
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0usmH8.kFGRitLFVAoMKwonmFHFkxHByS"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  const { allowed, retryAfterMs } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  const isSecure = proto === "https"
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 })
  }

  const db = await readDB()
  const user = db.users.find((u) => u.username === username)
  const hash = user?.passwordHash ?? DUMMY_HASH
  const valid = await bcrypt.compare(String(password), hash)

  if (!user || !valid) {
    return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 })
  }

  clearRateLimit(ip)
  await createSession({ id: user.id, username: user.username, role: user.role, name: user.name }, isSecure)
  return NextResponse.json({ ok: true, role: user.role, name: user.name })
}

export async function DELETE() {
  await deleteSession()
  return NextResponse.json({ ok: true })
}
