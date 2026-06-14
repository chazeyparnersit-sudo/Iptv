import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB } from "@/lib/db"
import { createSession, deleteSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  const isSecure = proto === "https"
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 })
  }

  const db = await readDB()
  const user = db.users.find((u) => u.username === username)

  if (!user) {
    return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 })
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash)
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 })
  }

  await createSession({ id: user.id, username: user.username, role: user.role, name: user.name }, isSecure)

  return NextResponse.json({ ok: true, role: user.role, name: user.name })
}

export async function DELETE() {
  await deleteSession()
  return NextResponse.json({ ok: true })
}
