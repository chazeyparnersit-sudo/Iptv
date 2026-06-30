import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"
import { SECRET } from "@/lib/jwt-secret"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Antes esta función solo validaba la firma del JWT. lib/guard.ts (usado en
// los endpoints /api/*) sí valida tokenVersion contra la base de datos para
// detectar sesiones revocadas (logout, botón "revocar" del admin), pero el
// middleware (que protege las PÁGINAS /tv, /admin, /rrhh, etc.) no lo hacía:
// una sesión revocada seguía cargando la página, aunque sus llamadas a la
// API ya fallaran. Usamos fetch directo a la REST API de Supabase (en vez
// del cliente supabase-js) para mantenerlo liviano en el runtime Edge.
async function getSessionPayload(req: NextRequest) {
  const token = req.cookies.get("session")?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const session = payload as {
      id: string
      username: string
      role: string
      name: string
      tokenVersion?: number
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return session

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(session.id)}&select=tokenVersion`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{ tokenVersion?: number }>
    const dbTokenVersion = rows[0]?.tokenVersion ?? 0
    if (dbTokenVersion !== (session.tokenVersion ?? 0)) return null

    return session
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/tv")) {
    const session = await getSessionPayload(req)
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin")) {
    const session = await getSessionPayload(req)
    if (!session || session.role !== "admin") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/rrhh")) {
    const session = await getSessionPayload(req)
    if (!session || (session.role !== "rrhh" && session.role !== "admin")) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/transmitir")) {
    const session = await getSessionPayload(req)
    if (!session || (session.role !== "jefe" && session.role !== "admin")) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/diagnostico")) {
    const session = await getSessionPayload(req)
    if (!session || session.role !== "admin") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/tv/:path*", "/admin/:path*", "/rrhh/:path*", "/transmitir/:path*", "/diagnostico/:path*"],
}
