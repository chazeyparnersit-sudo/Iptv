import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { UserRole } from "./types"
import { SECRET } from "./jwt-secret"

export interface SessionPayload {
  id: string
  username: string
  role: UserRole
  name: string
  tokenVersion: number
}

export async function createSession(payload: SessionPayload, secure = false): Promise<string> {
  const isTV = payload.role === "tv"
  const expiresIn = isTV ? "60d" : "8h"
  const maxAge = isTV ? 60 * 60 * 24 * 60 : 60 * 60 * 8

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  })
  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null
  return verifySession(token)
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}
