"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import {
  Monitor,
  RadioTower,
  RotateCcw,
  Settings,
  Pencil,
  Check,
  GripVertical,
  ChevronDown,
  Cast,
  Volume2,
  VolumeX,
} from "lucide-react"
import { fetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { BackButton } from "@/components/back-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { WhipBroadcaster } from "@/components/whip-broadcaster"
import type { Channel, ResolvedAssignment, TV } from "@/lib/types"

interface TVWithStatus extends TV {
  online: boolean
  current: ResolvedAssignment | null
}

const sourceLabels: Record<string, string> = {
  LIVE: "En vivo",
  CANVA: "Canva",
  ANNOUNCEMENT: "Anuncio",
  VIDEO_LOOP: "Video",
}

export function AdminClient() {
  const { data: tvData, mutate: mutateTvs } = useSWR<{ tvs: TVWithStatus[] }>(
    "/api/tvs",
    fetcher,
    { refreshInterval: 4000 },
  )
  const { data: chData } = useSWR<{ channels: Channel[] }>("/api/channels", fetcher, {
    refreshInterval: 8000,
  })
  const { data: mtxData } = useSWR<{ paths: Record<string, { ready: boolean }>; reachable: boolean }>(
    "/api/mediamtx/status",
    fetcher,
    { refreshInterval: 5000 },
  )

  const tvs = tvData?.tvs ?? []
  const channels = chData?.channels ?? []
  const paths = mtxData?.paths ?? {}
  const liveChannels = channels.filter((c) => c.sourceType === "LIVE")
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastChannelId, setBroadcastChannelId] = useState<string>("")
  const selectedBroadcastChannel = liveChannels.find(
    (c) => String(c.id) === broadcastChannelId,
  )

  async function assignChannel(tvId: number, channelId: number) {
    await fetch("/api/assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tvId, sourceType: "LIVE", channel: channelId }),
    })
    mutateTvs()
  }

  async function resetTv(tvId: number) {
    await fetch(`/api/reset?tv=${tvId}`, { method: "POST" })
    mutateTvs()
  }

  async function resetAll() {
    await fetch("/api/reset/all", { method: "POST" })
    mutateTvs()
  }

  async function renameTv(tvId: number, name: string) {
    await fetch("/api/tvs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tvId, name }),
    })
    mutateTvs()
  }

  async function setVolume(tvId: number, volume: number) {
    await fetch("/api/tvs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tvId, volume }),
    })
    mutateTvs()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-slate-900">Panel de Administración</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/sources">
                <Settings className="mr-1.5 h-4 w-4" />
                Configurar canales
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={resetAll}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Restablecer todo a vivo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login" }}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* MediaMTX status notice */}
        {mtxData && !mtxData.reachable && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            No se pudo conectar con MediaMTX. El estado de los canales no está disponible.
          </div>
        )}

        {/* Channel palette (draggable) */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-slate-500">
            Canales disponibles — arrastra a una TV para asignar
          </h2>
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => {
              const live = paths[c.mediamtxPath]?.ready
              return (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("channelId", String(c.id))}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  <RadioTower className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-300"}`}
                    title={live ? "Activo" : "Inactivo"}
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* TV grid */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tvs.map((tv) => (
            <TvCard
              key={tv.id}
              tv={tv}
              channels={channels}
              paths={paths}
              onAssign={assignChannel}
              onReset={resetTv}
              onRename={renameTv}
              onVolumeChange={setVolume}
            />
          ))}
        </section>

        {/* Browser broadcast */}
        <Collapsible open={broadcastOpen} onOpenChange={setBroadcastOpen} className="mt-8">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <Cast className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Transmitir desde el navegador
                </h2>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                  broadcastOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-slate-200 px-4 py-4">
                {liveChannels.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay canales en vivo configurados.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="max-w-xs">
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Canal destino
                      </label>
                      <Select
                        value={broadcastChannelId}
                        onValueChange={setBroadcastChannelId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {liveChannels.map((c) => {
                            const live = paths[c.mediamtxPath]?.ready
                            return (
                              <SelectItem key={c.id} value={String(c.id)}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      live ? "bg-emerald-500" : "bg-slate-300"
                                    }`}
                                  />
                                  {c.name}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedBroadcastChannel && (
                      <WhipBroadcaster
                        key={selectedBroadcastChannel.mediamtxPath}
                        channelPath={selectedBroadcastChannel.mediamtxPath}
                        channelName={selectedBroadcastChannel.name}
                      />
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Gestión de usuarios */}
        <UsersSection />
      </main>
    </div>
  )
}

function TvCard({
  tv,
  channels,
  paths,
  onAssign,
  onReset,
  onRename,
  onVolumeChange,
}: {
  tv: TVWithStatus
  channels: Channel[]
  paths: Record<string, { ready: boolean }>
  onAssign: (tvId: number, channelId: number) => void
  onReset: (tvId: number) => void
  onRename: (tvId: number, name: string) => void
  onVolumeChange: (tvId: number, volume: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tv.name)
  const [dragOver, setDragOver] = useState(false)
  // Estado local para que el slider se sienta instantáneo; el valor real se
  // manda con debounce para no spamear /api/tvs en cada pixel de arrastre.
  const [volume, setVolumeLocal] = useState(tv.volume ?? 100)
  const volumeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setVolumeLocal(tv.volume ?? 100)
  }, [tv.volume])

  function handleVolumeInput(v: number) {
    setVolumeLocal(v)
    if (volumeDebounce.current) clearTimeout(volumeDebounce.current)
    volumeDebounce.current = setTimeout(() => onVolumeChange(tv.id, v), 250)
  }

  const current = tv.current
  const currentChannel = channels.find((c) => c.id === tv.channel)
  const isOverride = current && current.sourceType !== "LIVE"

  function saveName() {
    setEditing(false)
    if (name.trim() && name !== tv.name) onRename(tv.id, name.trim())
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const channelId = Number(e.dataTransfer.getData("channelId"))
        if (channelId) onAssign(tv.id, channelId)
      }}
      className={`flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors ${
        dragOver ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="h-8"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveName}>
                <Check className="h-4 w-4 text-emerald-600" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setName(tv.name)
                setEditing(true)
              }}
              className="group flex items-center gap-1.5 text-left"
            >
              <span className="font-semibold text-slate-900">{tv.name}</span>
              <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-400">TV #{tv.id}</p>
        </div>
        <Badge
          variant="outline"
          className={
            tv.online
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }
        >
          <span
            className={`mr-1.5 h-1.5 w-1.5 rounded-full ${tv.online ? "bg-emerald-500" : "bg-slate-400"}`}
          />
          {tv.online ? "En línea" : "Desconectada"}
        </Badge>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-400">Reproduciendo ahora</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-medium text-slate-800">
            {current?.channelName ?? currentChannel?.name ?? "—"}
          </span>
          {current && (
            <Badge variant="secondary" className="text-xs">
              {sourceLabels[current.sourceType]}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={isOverride ? "" : String(tv.channel)}
          onValueChange={(v) => onAssign(tv.id, Number(v))}
        >
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder="Reasignar canal" />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => {
              const live = paths[c.mediamtxPath]?.ready
              return (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-300"}`}
                    />
                    {c.name}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onReset(tv.id)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Vivo
        </Button>
      </div>

      <div className="flex items-center gap-2 px-0.5">
        {volume === 0 ? (
          <VolumeX className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => handleVolumeInput(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-blue-600"
          aria-label={`Volumen TV ${tv.name}`}
        />
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-500">{volume}%</span>
      </div>

      <a
        href={`/tv?tv=${tv.id}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Abrir pantalla de TV #{tv.id} →
      </a>
    </div>
  )
}

function UsersSection() {
  const [users, setUsers] = useState<{id:string;username:string;role:string;name:string;createdAt:string}[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ username: "", password: "", role: "rrhh", name: "" })
  const [editId, setEditId] = useState<string|null>(null)
  const [editForm, setEditForm] = useState({ username: "", password: "", role: "rrhh", name: "" })
  const [error, setError] = useState<string|null>(null)

  async function load() {
    setLoading(true)
    const r = await fetch("/api/users")
    const d = await r.json()
    setUsers(d.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    if (d.error) { setError(d.error); return }
    setForm({ username: "", password: "", role: "rrhh", name: "" })
    load()
  }

  async function handleEdit(id: string) {
    setError(null)
    const body: Record<string,string> = { id, ...editForm }
    if (!editForm.password) delete body.password
    const r = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    if (d.error) { setError(d.error); return }
    setEditId(null)
    load()
  }

  async function handleRevoke(id: string, username: string) {
    if (!confirm(`¿Revocar sesión activa de "${username}"? Tendrá que volver a iniciar sesión.`)) return
    const r = await fetch(`/api/users/${id}/revoke`, { method: "POST" })
    const d = await r.json()
    if (d.error) { setError(d.error); return }
    setError(null)
    alert(`Sesión de "${username}" revocada correctamente.`)
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return
    const r = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    const d = await r.json()
    if (d.error) { setError(d.error); return }
    load()
  }

  const roleLabel: Record<string,string> = { admin: "Admin", rrhh: "RRHH", jefe: "Jefe", tv: "TV" }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Gestión de usuarios</h2>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Tabla */}
      <div className="mb-6 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="pb-2 pr-4 font-medium">Usuario</th>
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">Rol</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  {editId === u.id ? (
                    <>
                      <td className="py-2 pr-2">
                        <input className="w-full rounded border border-slate-200 px-2 py-1 text-xs" value={editForm.username} onChange={e => setEditForm(f => ({...f, username: e.target.value}))} />
                      </td>
                      <td className="py-2 pr-2">
                        <input className="w-full rounded border border-slate-200 px-2 py-1 text-xs" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                      </td>
                      <td className="py-2 pr-2">
                        <select className="rounded border border-slate-200 px-2 py-1 text-xs" value={editForm.role} onChange={e => setEditForm(f => ({...f, role: e.target.value}))}>
                          <option value="admin">Admin</option>
                          <option value="rrhh">RRHH</option>
                          <option value="jefe">Jefe</option>
                          <option value="tv">TV</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <input className="w-24 rounded border border-slate-200 px-2 py-1 text-xs" placeholder="Nueva clave" type="password" value={editForm.password} onChange={e => setEditForm(f => ({...f, password: e.target.value}))} />
                          <button onClick={() => handleEdit(u.id)} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Guardar</button>
                          <button onClick={() => setEditId(null)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 font-medium text-slate-800">{u.username}</td>
                      <td className="py-2 pr-4 text-slate-600">{u.name}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{roleLabel[u.role] ?? u.role}</span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditId(u.id); setEditForm({ username: u.username, name: u.name, role: u.role, password: "" }) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Editar</button>
                          <button onClick={() => handleRevoke(u.id, u.username)} className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">Revocar</button>
                          <button onClick={() => handleDelete(u.id, u.username)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulario crear */}
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Usuario</label>
          <input required className="rounded border border-slate-200 px-2 py-1.5 text-sm" placeholder="username" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Nombre</label>
          <input required className="rounded border border-slate-200 px-2 py-1.5 text-sm" placeholder="Nombre completo" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Contraseña</label>
          <input required type="password" className="rounded border border-slate-200 px-2 py-1.5 text-sm" placeholder="••••••" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Rol</label>
          <select className="rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
            <option value="admin">Admin</option>
            <option value="rrhh">RRHH</option>
            <option value="jefe">Jefe</option>
            <option value="tv">TV</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Crear usuario</button>
      </form>
    </section>
  )
}
