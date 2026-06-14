"use client"

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BackButton } from "@/components/back-button"

interface PinGateProps {
  panel: "admin" | "rrhh"
  title: string
  accent?: "blue" | "emerald"
  children: React.ReactNode
}

const STORAGE_PREFIX = "iptv_auth_"

export function PinGate({ panel, title, accent = "blue", children }: PinGateProps) {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAuthed(localStorage.getItem(STORAGE_PREFIX + panel) === "1")
    setReady(true)
  }, [panel])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panel, pin }),
      })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem(STORAGE_PREFIX + panel, "1")
        setAuthed(true)
      } else {
        setError(true)
        setPin("")
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return null

  if (authed) return <>{children}</>

  const accentBtn =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-blue-600 hover:bg-blue-700"

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="p-4">
        <BackButton />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                accent === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
              }`}
            >
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">Ingresa el PIN para continuar</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin" className="text-slate-700">
                PIN
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="text-center text-lg tracking-widest"
              />
              {error && <p className="text-sm text-red-500">PIN incorrecto. Intenta de nuevo.</p>}
            </div>
            <Button type="submit" disabled={loading || !pin} className={`w-full text-white ${accentBtn}`}>
              {loading ? "Verificando…" : "Ingresar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
