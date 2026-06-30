"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import { Users, RotateCcw, Send, Trash2, Tv, Clock, Check, FileUp } from "lucide-react"
import { fetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/back-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Channel, ResolvedAssignment, ScheduleItem, SourceType, TV } from "@/lib/types"

interface TVWithStatus extends TV {
  online: boolean
  current: ResolvedAssignment | null
}

type ContentType = "LIVE" | "CANVA" | "ANNOUNCEMENT" | "VIDEO_LOOP" | "PDF" | "IMAGE_SLIDES"

const contentTabs: { value: ContentType; label: string }[] = [
  { value: "LIVE", label: "Transmision en vivo" },
  { value: "CANVA", label: "Presentacion Canva" },
  { value: "ANNOUNCEMENT", label: "Anuncio de texto" },
  { value: "VIDEO_LOOP", label: "Video en bucle" },
  { value: "PDF", label: "PDF" },
  { value: "IMAGE_SLIDES", label: "Imagenes" },
]

export function RrhhClient() {
  const [uploadType, setUploadType] = useState<"IMAGE_SLIDES" | "PDF" | "VIDEO_LOOP">("IMAGE_SLIDES")
  const [mediaInfo, setMediaInfo] = useState<{
    exists: boolean
    type?: string
    originalName?: string
    uploadedAt?: string
    slideCount?: number
    filename?: string
  } | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/presentation-info")
      .then((r) => r.json())
      .then(setMediaInfo)
      .catch(() => {})
  }, [])

  async function uploadMedia(e: React.ChangeEvent<HTMLInputElement>, tvIds: number[]) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaUploading(true)
    setMediaError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", uploadType)
      fd.append("tvIds", JSON.stringify(tvIds))
      const res = await fetch("/api/upload-media", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error desconocido")
      setMediaInfo({ exists: true, ...data })
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : "Error al subir")
    } finally {
      setMediaUploading(false)
      e.target.value = ""
    }
  }

  const { data: tvData, mutate: mutateTvs } = useSWR<{ tvs: TVWithStatus[] }>("/api/tvs", fetcher, {
    refreshInterval: 4000,
  })
  const { data: chData } = useSWR<{ channels: Channel[] }>("/api/channels", fetcher)
  const { data: scData, mutate: mutateSchedule } = useSWR<{ schedule: ScheduleItem[] }>(
    "/api/schedule",
    fetcher,
    { refreshInterval: 5000 },
  )

  const tvs = tvData?.tvs ?? []
  const channels = chData?.channels ?? []
  const schedule = scData?.schedule ?? []

  const [selected, setSelected] = useState<number[]>([])
  const [contentType, setContentType] = useState<ContentType>("LIVE")
  const [channelId, setChannelId] = useState<string>("")
  const [canvaUrl, setCanvaUrl] = useState("")
  const [message, setMessage] = useState("")
  const [bgColor, setBgColor] = useState("#1e3a5f")
  const [textColor, setTextColor] = useState("#ffffff")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const allSelected = selected.length === tvs.length && tvs.length > 0

  function toggleTv(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function toggleAll() {
    setSelected(allSelected ? [] : tvs.map((t) => t.id))
  }

  // tvId es obligatorio para VIDEO_LOOP/PDF/IMAGE_SLIDES porque el contenido
  // se guarda en una carpeta por TV (public/presentations/tv-{tvId}/...).
  // Antes esto apuntaba a /presentations/<archivo> (raíz), que no es donde
  // upload-media realmente escribe -> la TV nunca veía el video nuevo.
  function buildPayload(tvId: number) {
    const base: Record<string, unknown> = { sourceType: contentType as SourceType }
    if (contentType === "LIVE") base.channelId = Number(channelId)
    if (contentType === "CANVA") base.sourceUrl = canvaUrl
    if (contentType === "ANNOUNCEMENT") {
      base.content = message
      base.bgColor = bgColor
      base.textColor = textColor
    }
    if (contentType === "VIDEO_LOOP") {
      const filename = mediaInfo?.filename ?? "video.mp4"
      // Cache-buster: el nombre de archivo es siempre el mismo (video.mp4),
      // así que sin esto el sourceUrl queda idéntico entre subidas y la TV
      // (que evita re-render si sourceUrl no cambia) nunca recarga el video,
      // además del caché del navegador para esa misma URL.
      const v = mediaInfo?.uploadedAt ? Date.parse(mediaInfo.uploadedAt) : Date.now()
      base.sourceUrl = `/presentations/tv-${tvId}/${filename}?v=${v}`
    }
    if (contentType === "PDF") {
      base.sourceUrl = `/presentations/tv-${tvId}/presentation.pdf`
    }
    if (contentType === "IMAGE_SLIDES") {
      base.sourceUrl = `/presentations/tv-${tvId}/slides/`
    }
    return base
  }

  function valid() {
    if (selected.length === 0) return false
    if (contentType === "LIVE") return Boolean(channelId)
    if (contentType === "CANVA") return Boolean(canvaUrl.trim())
    if (contentType === "ANNOUNCEMENT") return Boolean(message.trim())
    if (contentType === "VIDEO_LOOP") return true   // usa el video subido
    if (contentType === "PDF") return true           // usa el PDF subido
    if (contentType === "IMAGE_SLIDES") return true  // usa el ZIP subido
    return false
  }

  async function apply() {
    if (!valid()) return
    setSending(true)

    if (startTime || endTime) {
      // Scheduled — una entrada de schedule cubre varias TVs con UN sourceUrl.
      // Para VIDEO_LOOP/PDF/IMAGE_SLIDES (contenido guardado por TV), el archivo
      // subido se replica igual en la carpeta de cada TV seleccionada (ver
      // upload-media), así que usamos la primera TV seleccionada como referencia
      // válida para construir la ruta.
      const payload = buildPayload(selected[0])
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, tvIds: selected, startTime, endTime }),
      })
      mutateSchedule()
    } else {
      // Immediate override on each selected TV — payload por TV
      await Promise.all(
        selected.map(async (tvId) => {
          const payload = buildPayload(tvId)
          const res = await fetch("/api/assignment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tvId, ...payload }),
          })
          const data = await res.json()
          console.log(`TV ${tvId}:`, res.status, data)
          return data
        })
      )
    }
    mutateTvs()
    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
    // Reset form lightly
    setMessage("")
    setCanvaUrl("")
    setStartTime("")
    setEndTime("")
  }

  async function restoreTv(tvId: number) {
    await fetch(`/api/reset?tv=${tvId}`, { method: "POST" })
    mutateTvs()
    mutateSchedule()
  }

  async function restoreAll() {
    await fetch("/api/reset/all", { method: "POST" })
    mutateTvs()
    mutateSchedule()
  }

  async function cancelSchedule(id: string) {
    await fetch(`/api/schedule?id=${id}`, { method: "DELETE" })
    mutateSchedule()
    mutateTvs()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <h1 className="text-lg font-semibold text-slate-900">Panel de Contenido de RRHH</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={restoreAll} size="sm" className="bg-red-500 text-white hover:bg-red-600">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Restaurar todo a vivo
            </Button>
            <Button size="sm" variant="outline" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login" }}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-5">
        {/* Form */}
        <section className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Publicar contenido</h2>
            <p className="mt-1 text-sm text-slate-500">
              Elige que televisores reciben el contenido y que mostrar.
            </p>

            {/* TV selector */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-slate-700">1. Selecciona televisores</Label>
                <button
                  onClick={toggleAll}
                  className="text-sm font-medium text-emerald-600 hover:underline"
                >
                  {allSelected ? "Quitar todos" : "Seleccionar todos"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tvs.map((tv) => {
                  const on = selected.includes(tv.id)
                  return (
                    <button
                      key={tv.id}
                      type="button"
                      onClick={() => toggleTv(tv.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        on
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{tv.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content type */}
            <div className="mt-6">
              <Label className="text-slate-700">2. Tipo de contenido</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {contentTabs.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setContentType(t.value)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      contentType === t.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content fields */}
            <div className="mt-4">
              {contentType === "LIVE" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-slate-700">Canal en vivo</Label>
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {contentType === "CANVA" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-slate-700">Enlace de Canva</Label>
                  <Input
                    value={canvaUrl}
                    onChange={(e) => setCanvaUrl(e.target.value)}
                    placeholder="https://www.canva.com/design/..../view"
                  />
                </div>
              )}

              {contentType === "ANNOUNCEMENT" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-slate-700">Mensaje</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Escribe el mensaje a mostrar…"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-slate-700">Color de fondo</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-slate-200"
                        />
                        <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-slate-700">Color de texto</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-slate-200"
                        />
                        <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-center rounded-lg px-4 py-8 text-center text-xl font-semibold"
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    {message || "Vista previa del anuncio"}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule (optional) */}
            <div className="mt-6">
              <Label className="flex items-center gap-1.5 text-slate-700">
                <Clock className="h-4 w-4 text-slate-400" />
                3. Programación (opcional)
              </Label>
              <p className="mb-2 mt-0.5 text-xs text-slate-400">
                Déjalo vacío para aplicar de inmediato.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-slate-500">Inicio</Label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-slate-500">Fin</Label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={apply}
              disabled={!valid() || sending}
              className={`mt-6 w-full text-white ${sent ? "bg-emerald-800" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending
                ? "Aplicando…"
                : sent
                  ? "✓ Aplicado"
                  : startTime || endTime
                    ? "Programar contenido"
                    : "Aplicar ahora"}
            </Button>

            {/* Media Upload */}
            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <FileUp className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Subir contenido</h3>
              </div>

              {/* Tabs de tipo */}
              <div className="flex gap-2 mb-4">
                {(["IMAGE_SLIDES", "PDF", "VIDEO_LOOP"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setUploadType(t)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      uploadType === t
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t === "IMAGE_SLIDES" ? "Imágenes (ZIP)" : t === "PDF" ? "PDF" : "Video (MP4)"}
                  </button>
                ))}
              </div>

              {/* Info del archivo actual */}
              {mediaInfo?.exists && mediaInfo.type === uploadType ? (
                <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-700 truncate">{mediaInfo.originalName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mediaInfo.type === "IMAGE_SLIDES" && `${mediaInfo.slideCount} diapositivas Â· `}
                    Subido el{" "}
                    {mediaInfo.uploadedAt
                      ? new Date(mediaInfo.uploadedAt).toLocaleString("es", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "â€”"}
                  </p>
                </div>
              ) : (
                <p className="mb-3 text-sm text-slate-400">
                  {uploadType === "IMAGE_SLIDES" && "No hay slideshow subido."}
                  {uploadType === "PDF" && "No hay PDF subido."}
                  {uploadType === "VIDEO_LOOP" && "No hay video subido."}
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                <FileUp className="h-4 w-4 shrink-0" />
                {mediaUploading ? "Subiendo…" : mediaInfo?.exists && mediaInfo.type === uploadType ? "Reemplazar" : "Subir archivo"}
                <input
                  type="file"
                  accept={
                    uploadType === "IMAGE_SLIDES" ? ".zip,application/zip"
                    : uploadType === "PDF" ? "application/pdf"
                    : "video/mp4,video/webm,video/*"
                  }
                  className="sr-only"
                  disabled={mediaUploading}
                  onChange={(e) => uploadMedia(e, selected)}
                />
              </label>

              {mediaError && <p className="mt-2 text-sm text-red-600">{mediaError}</p>}

              <p className="mt-2 text-xs text-slate-400">
                {uploadType === "IMAGE_SLIDES" && "Exporta desde Canva como PNG, descarga el ZIP y súbelo aquí."}
                {uploadType === "PDF" && "Exporta desde Canva como PDF y súbelo aquí. Los videos quedan como imagen fija."}
                {uploadType === "VIDEO_LOOP" && "El video se reproduce en bucle continuo sin audio."}
              </p>
            </div>
          </div>
        </section>

        {/* Sidebar: TV status + schedule */}
        <section className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Tv className="h-4 w-4 text-slate-400" />
              Estado de televisores
            </h2>
            <div className="flex flex-col gap-2">
              {tvs.map((tv) => (
                <div
                  key={tv.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{tv.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {tv.current?.channelName ?? "–"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restoreTv(tv.id)}
                    className="h-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Vivo
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-slate-400" />
              Contenido programado
            </h2>
            {schedule.length === 0 ? (
              <p className="text-sm text-slate-400">No hay contenido programado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {schedule.map((s) => (
                  <ScheduleRow key={s.id} item={s} tvs={tvs} onCancel={cancelSchedule} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function ScheduleRow({
  item,
  tvs,
  onCancel,
}: {
  item: ScheduleItem
  tvs: TVWithStatus[]
  onCancel: (id: string) => void
}) {
  const now = new Date()
  const isActive =
    (!item.startTime || now >= new Date(item.startTime)) &&
    (!item.endTime || now <= new Date(item.endTime))
  const isUpcoming = item.startTime && now < new Date(item.startTime)

  const names = item.tvIds
    .map((id) => tvs.find((t) => t.id === id)?.name ?? `TV ${id}`)
    .join(", ")

  const label =
    item.sourceType === "ANNOUNCEMENT"
      ? `Anuncio: "${item.content}"`
      : item.sourceType === "CANVA"
        ? "Presentación Canva"
        : "Transmisión en vivo"

  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-800">{label}</p>
            <Badge
              variant="outline"
              className={
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : isUpcoming
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }
            >
              {isActive ? "Activo" : isUpcoming ? "Próximo" : "Finalizado"}
            </Badge>
          </div>
          <p className="truncate text-xs text-slate-400">{names}</p>
          {(item.startTime || item.endTime) && (
            <p className="mt-0.5 text-xs text-slate-400">
              {fmt(item.startTime)} – {fmt(item.endTime)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCancel(item.id)}
          className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
          aria-label="Cancelar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function fmt(iso: string) {
  if (!iso) return "â€”"
  try {
    return new Date(iso).toLocaleString("es", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}


