import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { readDB } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { getSession } from "@/lib/auth"
import { requireRole } from "@/lib/guard"
import type { User, UserRole } from "@/lib/types"
import { userPostSchema, userPatchSchema } from "@/lib/schemas"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError
  const { data: users } = await supabase.from('users').select('id, username, role, name, createdAt')
  return NextResponse.json({ users: users ?? [] })
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError
  const parsed = userPostSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { username, password, role, name } = parsed.data
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
    tokenVersion: 0,
  }
  const { error } = await supabase.from('users').insert(newUser)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { passwordHash: _, ...safe } = newUser
  return NextResponse.json({ user: safe }, { status: 201 })
}

export async function PATCH(req: Request) {
  const { error: authError } = await requireRole("admin")
  if (authError) return authError
  const parsed2 = userPatchSchema.safeParse(await req.json())
  if (!parsed2.success) return NextResponse.json({ error: parsed2.error.flatten() }, { status: 400 })
  const { id, username, password, role, name } = parsed2.data
  const update: Pick<Partial<User>, "username" | "name" | "role" | "passwordHash"> = {}
  if (username) update.username = username
  if (name) update.name = name
  if (role) update.role = role
  if (password) update.passwordHash = bcrypt.hashSync(String(password), 10)

  const { data, error } = await supabase.from('users').update(update).eq('id', String(id)).select('id, username, role, name, createdAt').single()
  if (error) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  return NextResponse.json({ user: data })
}

export async function DELETE(req: Request) {
  const { error: authError, session } = await requireRole("admin")
  if (authError) return authError
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  if (String(id) === session.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
  }
  const { error } = await supabase.from('users').delete().eq('id', String(id))
  if (error) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
