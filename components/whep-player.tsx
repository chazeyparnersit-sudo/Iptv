"use client"
import { useEffect, useRef, useState } from "react"

interface WhepPlayerProps {
  url: string
  volume?: number
  audioUnlocked?: boolean
  className?: string
}
type Status = "connecting" | "playing" | "error"

const MAX_BUFFER_S = 1.5

export function WhepPlayer({ url, volume = 100, audioUnlocked = false, className }: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const driftRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastStats = useRef<{ delay: number; count: number }>({ delay: 0, count: 0 })
  const [status, setStatus] = useState<Status>("connecting")
  const [muted, setMuted] = useState(true)

  // Volumen controlado desde el admin (0-100). Solo aplica una vez que el
  // usuario ya desmuteó (o si volume llega en 0, fuerza mute de nuevo) —
  // el mute inicial sigue siendo obligatorio por la política de autoplay
  // de los navegadores, igual que antes.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.volume = Math.min(100, Math.max(0, volume)) / 100
    if (volume <= 0) setMuted(true)
  }, [volume])

  // audioUnlocked llega en true apenas se detecta CUALQUIER tecla del
  // control remoto / click en toda la página (ver tv-client.tsx). Antes
  // esto exigía tocar específicamente el botón "Toca para activar audio"
  // sobre el reproductor — incómodo en una Smart TV manejada por control
  // remoto. Mantenemos el botón como respaldo manual por si el evento
  // global no llega a dispararse por algún motivo.
  useEffect(() => {
    if (!audioUnlocked || !muted) return
    setMuted(false)
    videoRef.current?.play?.().catch(() => {
      // Bloqueado igual por el navegador: vuelve a quedar muted y el
      // botón manual sigue disponible.
      setMuted(true)
    })
  }, [audioUnlocked, muted])

  useEffect(() => {
    let cancelled = false

    function minimizeLatency(pc: RTCPeerConnection) {
      for (const receiver of pc.getReceivers()) {
        try {
          if ("playoutDelayHint" in receiver) (receiver as any).playoutDelayHint = 0
          if ("jitterBufferTarget" in receiver) (receiver as any).jitterBufferTarget = 0
        } catch {}
      }
    }

    function cleanup() {
      if (retryRef.current) clearTimeout(retryRef.current)
      if (driftRef.current) clearInterval(driftRef.current)
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    }

    function scheduleRetry(delay = 2000) {
      if (cancelled) return
      retryRef.current = setTimeout(() => { if (!cancelled) connect() }, delay)
    }

    function startDriftWatchdog(pc: RTCPeerConnection) {
      if (driftRef.current) clearInterval(driftRef.current)
      driftRef.current = setInterval(async () => {
        if (cancelled || !pcRef.current) return
        try {
          const stats = await pc.getStats()
          stats.forEach((r: any) => {
            if (r.type === "inbound-rtp" && r.kind === "video") {
              const delay = r.jitterBufferDelay ?? 0
              const count = r.jitterBufferEmittedCount ?? 0
              const dDelay = delay - lastStats.current.delay
              const dCount = count - lastStats.current.count
              lastStats.current = { delay, count }
              if (dCount > 0) {
                const avgBuffer = dDelay / dCount
                console.log("[whep] jitterBuffer ~", avgBuffer.toFixed(3), "s")
                if (avgBuffer > MAX_BUFFER_S) {
                  console.log("[whep] buffer drift -> reconectando al directo")
                  connect()
                }
              }
            }
          })
        } catch {}
      }, 2000)
    }

    async function connect() {
      cleanup()
      lastStats.current = { delay: 0, count: 0 }
      if (cancelled) return
      setStatus("connecting")
      try {
        const iceRes = await fetch("/api/ice-servers")
        const iceServers = await iceRes.json()
        const pc = new RTCPeerConnection({ iceServers })
        pcRef.current = pc

        pc.addTransceiver("video", { direction: "recvonly" })
        pc.addTransceiver("audio", { direction: "recvonly" })
        minimizeLatency(pc)

        pc.ontrack = (ev) => {
          if (videoRef.current && ev.streams[0]) {
            videoRef.current.srcObject = ev.streams[0]
            videoRef.current.play?.().catch(() => {})
          }
          minimizeLatency(pc)
        }

        pc.onconnectionstatechange = () => {
          const s = pc.connectionState
          if (s === "connected") {
            setStatus("playing")
            minimizeLatency(pc)
            startDriftWatchdog(pc)
          }
          if (s === "failed" || s === "disconnected" || s === "closed") {
            setStatus("error")
            scheduleRetry()
          }
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve()
          let timeoutId: ReturnType<typeof setTimeout>
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check)
              clearTimeout(timeoutId)
              resolve()
            }
          }
          pc.addEventListener("icegatheringstatechange", check)
          timeoutId = setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange", check)
            resolve()
          }, 400)
        })

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp ?? "",
        })
        if (!res.ok) throw new Error(`WHEP ${res.status}`)
        const answer = await res.text()
        if (cancelled) return
        await pc.setRemoteDescription({ type: "answer", sdp: answer })
        minimizeLatency(pc)
      } catch (err) {
        if (cancelled) return
        console.log("[whep] connect error:", (err as Error).message)
        setStatus("error")
        scheduleRetry()
      }
    }

    connect()
    return () => { cancelled = true; cleanup() }
  }, [url])

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-full w-full bg-black object-contain"
      />
      {muted && status === "playing" && (
        <button
          onClick={() => {
            setMuted(false)
            videoRef.current?.play?.().catch(() => {})
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40"
        >
          <span className="rounded-full bg-white/20 px-6 py-3 text-white text-lg font-semibold backdrop-blur">
            🔇 Toca para activar audio
          </span>
        </button>
      )}
      {status !== "playing" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-500">
            {status === "connecting" ? "Conectando…" : "Sin señal — reintentando…"}
          </p>
        </div>
      )}
    </div>
  )
}
