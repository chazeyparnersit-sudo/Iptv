"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { WhipBroadcaster } from "@/components/whip-broadcaster"

interface Channel {
  id: number
  name: string
  sourceType: string
  mediamtxPath: string
}

export default function TransmitirPage() {
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [selected, setSelected] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => {
        const live = (d.channels as Channel[]).filter((c) => c.sourceType === "LIVE")
        setChannels(live)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-bold">Transmitir</h1>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {!selected ? (
          <>
            <p className="mb-6 text-slate-400">Selecciona el canal al que quieres transmitir:</p>
            {loading ? (
              <p className="text-slate-500">Cargando canales…</p>
            ) : channels.length === 0 ? (
              <p className="text-slate-500">No hay canales LIVE disponibles.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelected(ch)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-4 text-left hover:border-blue-500 hover:bg-slate-800"
                  >
                    <span className="font-medium">{ch.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{ch.mediamtxPath}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                ← Volver
              </button>
              <span className="font-semibold">{selected.name}</span>
            </div>
            <WhipBroadcaster channelPath={selected.mediamtxPath} />
          </>
        )}
      </main>
    </div>
  )
}
