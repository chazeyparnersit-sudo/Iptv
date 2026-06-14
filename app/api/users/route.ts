import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB, updateDB } from "@/lib/db"
import { getSession } from "@/lib/auth"
import type { User, UserRole } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const db = await readDB()
  const users = db.users.map(({ passwordHash: _, ...u }) => u)
  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { username, password, role, name } = await req.json()
  if (!username || !password || !role || !name) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
  }
  const validRoles: UserRole[] = ["admin", "rrhh", "jefe", "tv"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
  }
  const result = await updateDB((db) => {
    const exists = db.users.find((u) => u.username === username)
    if (exists) return { error: "El usuario ya existe" }
    const passwordHash = bcrypt.hashSync(String(password), 10)
    const newUser: User = {
      id: String(Date.now()),
      username,
      passwordHash,
      role,
      name,
      createdAt: new Date().toISOString(),
    }
    db.users.push(newUser)
    const { passwordHash: _, ...safe } = newUser
    return { user: safe }
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }
  return NextResponse.json(result, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id, username, password, role, name } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  }
  const result = await updateDB((db) => {
    const idx = db.users.findIndex((u) => u.id === String(id))
    if (idx === -1) return { error: "Usuario no encontrado" }
    if (username) db.users[idx].username = username
    if (name) db.users[idx].name = name
    if (role) db.users[idx].role = role
    if (password) db.users[idx].passwordHash = bcrypt.hashSync(String(password), 10)
    const { passwordHash: _, ...safe } = db.users[idx]
    return { user: safe }
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  return NextResponse.json(result)
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  }
  if (String(id) === session.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
  }
  const result = await updateDB((db) => {
    const idx = db.users.findIndex((u) => u.id === String(id))
    if (idx === -1) return { error: "Usuario no encontrado" }
    db.users.splice(idx, 1)
    return { ok: true }
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  return NextResponse.json(result)
}
