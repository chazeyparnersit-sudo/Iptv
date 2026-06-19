import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB } from "@/lib/db"
import { createSession, deleteSession, getSession } from "@/lib/auth"
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit"
import { supabase } from "@/lib/supabase"

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
  // Las TVs entran por HTTP directo al puerto 3000 (no pasan por Nginx), por lo que su
  // cookie NUNCA puede llevar `secure: true` o el navegador la descartaría. El resto de
  // roles entra siempre por HTTPS vía Nginx. En vez de confiar únicamente en el header
  // x-forwarded-proto (que dejaría de funcionar en silencio si Nginx fallara en reescribirlo),
  // usamos el rol como señal adicional: para no-TV, exigimos producción + header https.
  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  const isSecure =
    user.role === "tv"
      ? false
      : process.env.NODE_ENV === "production" && proto === "https"
  await createSession(
    { id: user.id, username: user.username, role: user.role, name: user.name, tokenVersion: user.tokenVersion ?? 0 },
    isSecure
  )
  return NextResponse.json({ ok: true, role: user.role, name: user.name })
}

export async function DELETE() {
  // Revocar el token actual incrementando tokenVersion, además de borrar la cookie.
  // Sin esto, un JWT filtrado/copiado antes del logout seguiría siendo válido hasta
  // su expiración natural (8h o 60d) aunque el usuario haya cerrado sesión.
  const session = await getSession()
  if (session) {
    const { data: current } = await supabase
      .from("users")
      .select("tokenVersion")
      .eq("id", session.id)
      .single()
    if (current) {
      await supabase
        .from("users")
        .update({ tokenVersion: (current.tokenVersion ?? 0) + 1 })
        .eq("id", session.id)
    }
  }
  await deleteSession()
  return NextResponse.json({ ok: true })
}
