import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { getSession } from "@/lib/auth"
import type { User, UserRole } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { data: users } = await supabase.from('users').select('id, username, role, name, createdAt')
  return NextResponse.json({ users: users ?? [] })
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
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).single()
  if (existing) return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 })

  const passwordHash = bcrypt.hashSync(String(password), 10)
  const newUser: User = {
    id: String(Date.now()),
    username,
    passwordHash,
    role,
    name,
    createdAt: new Date().toISOString(),
  }
  const { error } = await supabase.from('users').insert(newUser)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { passwordHash: _, ...safe } = newUser
  return NextResponse.json({ user: safe }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id, username, password, role, name } = await req.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  const update: any = {}
  if (username) update.username = username
  if (name) update.name = name
  if (role) {
    if (!["admin","rrhh","jefe","tv"].includes(role))
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    update.role = role
  }
  if (password) update.passwordHash = bcrypt.hashSync(String(password), 10)

  const { data, error } = await supabase.from('users').update(update).eq('id', String(id)).select('id, username, role, name, createdAt').single()
  if (error) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  return NextResponse.json({ user: data })
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  if (String(id) === session.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
  }
  const { error } = await supabase.from('users').delete().eq('id', String(id))
  if (error) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
