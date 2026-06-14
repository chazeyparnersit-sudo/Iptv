"use client"

import useSWR from "swr"
import { useEffect, useState } from "react"
import { RadioTower, Save, Copy, Check } from "lucide-react"
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
import type { Channel, SourceType } from "@/lib/types"

interface ChannelWithWhip extends Channel {
  whipUrl: string
}

const sourceTypes: { value: SourceType; label: string }[] = [
  { value: "LIVE", label: "En vivo (OBS / WHIP)" },
  { value: "CANVA", label: "Canva (iframe)" },
  { value: "ANNOUNCEMENT", label: "Anuncio de texto" },
  { value: "VIDEO_LOOP", label: "Video en bucle" },
]

export function SourcesClient() {
  const { data, mutate } = useSWR<{ channels: ChannelWithWhip[] }>("/api/channels", fetcher)
  const { data: mtxData } = useSWR<{ paths: Record<string, { ready: boolean }>; reachable: boolean }>(
    "/api/mediamtx/status",
    fetcher,
    { refreshInterval: 5000 },
  )

  const channels = data?.channels ?? []
  const paths = mtxData?.paths ?? {}

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <BackButton href="/admin" label="Volver a admin" />
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <RadioTower className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-slate-900">Configuración de canales</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-col gap-4">
          {channels.map((c) => (
            <ChannelEditor
              key={c.id}
              channel={c}
              live={paths[c.mediamtxPath]?.ready}
              onSaved={() => mutate()}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

function ChannelEditor({
  channel,
  live,
  onSaved,
}: {
  channel: ChannelWithWhip
  live?: boolean
  onSaved: () => void
}) {
  const [name, setName] = useState(channel.name)
  const [sourceType, setSourceType] = useState<SourceType>(channel.sourceType)
  const [sourceUrl, setSourceUrl] = useState(channel.sourceUrl)
  const [content, setContent] = useState(channel.content ?? "")
  const [bgColor, setBgColor] = useState(channel.bgColor ?? "#1e3a5f")
  const [textColor, setTextColor] = useState(channel.textColor ?? "#ffffff")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Keep local state in sync if upstream data changes
  useEffect(() => {
    setName(channel.name)
    setSourceType(channel.sourceType)
    setSourceUrl(channel.sourceUrl)
    setContent(channel.content ?? "")
    setBgColor(channel.bgColor ?? "#1e3a5f")
    setTextColor(channel.textColor ?? "#ffffff")
  }, [channel])

  async function save() {
    setSaving(true)
    await fetch(`/api/channels/${channel.id}/source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceType, sourceUrl, content, bgColor, textColor }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved()
  }

  function copyWhip() {
    navigator.clipboard.writeText(channel.whipUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
            {channel.id}
          </span>
          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {channel.mediamtxPath}
          </code>
        </div>
        <Badge
          variant="outline"
          className={
            live
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }
        >
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
          {live ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-slate-700">Nombre del canal</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-slate-700">Tipo de fuente</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceTypes.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Source-specific fields */}
      {(sourceType === "LIVE" || sourceType === "VIDEO_LOOP") && (
        <div className="mt-4 flex flex-col gap-1.5">
          <Label className="text-slate-700">URL de publicación WHIP (para OBS)</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {channel.whipUrl}
            </code>
            <Button variant="outline" size="icon" onClick={copyWhip} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Configura OBS para publicar vía WHIP a esta URL.
          </p>
        </div>
      )}

      {sourceType === "CANVA" && (
        <div className="mt-4 flex flex-col gap-1.5">
          <Label className="text-slate-700">URL de presentación de Canva</Label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.canva.com/design/..../view"
          />
        </div>
      )}

      {sourceType === "ANNOUNCEMENT" && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-slate-700">Mensaje</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el anuncio…"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Color de fondo" value={bgColor} onChange={setBgColor} />
            <ColorField label="Color de texto" value={textColor} onChange={setTextColor} />
          </div>
          <div
            className="flex items-center justify-center rounded-lg px-4 py-6 text-center text-lg font-semibold"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            {content || "Vista previa del anuncio"}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
          {saved ? (
            <>
              <Check className="mr-1.5 h-4 w-4" />
              Guardado
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar canal"}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-slate-700">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-slate-200"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
    </div>
  )
}
