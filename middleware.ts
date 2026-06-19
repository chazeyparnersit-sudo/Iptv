import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"
import { SECRET } from "@/lib/jwt-secret"

async function getSessionPayload(req: NextRequest) {
  const token = req.cookies.get("session")?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { id: string; username: string; role: string; name: string }
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
