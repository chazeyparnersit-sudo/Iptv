"use client"
import { useEffect, useRef, useState } from "react"
interface WhepPlayerProps {
  url: string
  className?: string
}
type Status = "connecting" | "playing" | "error"
export function WhepPlayer({ url, className }: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<Status>("connecting")
  const [muted, setMuted] = useState(true)
  useEffect(() => {
    let cancelled = false
    function cleanup() {
      if (retryRef.current) clearTimeout(retryRef.current)
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    }
    function scheduleRetry() {
      if (cancelled) return
      retryRef.current = setTimeout(() => { if (!cancelled) connect() }, 3000)
    }
    async function connect() {
      cleanup()
      if (cancelled) return
      setStatus("connecting")
      try {
        const iceRes = await fetch("/api/ice-servers")
        const iceServers = await iceRes.json()
        const pc = new RTCPeerConnection({ iceServers })
        pcRef.current = pc
        pc.addTransceiver("video", { direction: "recvonly" })
        pc.addTransceiver("audio", { direction: "recvonly" })
        pc.ontrack = (ev) => {
          if (videoRef.current && ev.streams[0]) {
            const video = videoRef.current
            video.srcObject = ev.streams[0]

            // Watchdog: si el video acumula más de 1.5s de drift respecto al live, resincronizar
            const watchdog = setInterval(() => {
              if (!video.buffered.length || video.paused) return
              const bufferedEnd = video.buffered.end(video.buffered.length - 1)
              const drift = bufferedEnd - video.currentTime
              if (drift > 1.5) {
                console.warn(`[whep] drift ${drift.toFixed(2)}s — resincronizando`)
                video.currentTime = bufferedEnd - 0.08
              }
            }, 800)

            // Limpiar watchdog cuando el pc se cierre
            pc.addEventListener("connectionstatechange", () => {
              if (pc.connectionState === "closed" || pc.connectionState === "failed") {
                clearInterval(watchdog)
              }
            })
          }
        }
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState
          if (s === "connected") setStatus("playing")
          if (s === "failed" || s === "disconnected" || s === "closed") {
            setStatus("error")
            scheduleRetry()
          }
        }
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve()
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check)
              resolve()
            }
          }
          pc.addEventListener("icegatheringstatechange", check)
          setTimeout(resolve, 400)
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
      } catch (err) {
        if (cancelled) return
        console.log("[v0] WHEP connect error:", (err as Error).message)
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
        onLoadedMetadata={(e) => { const v = e.currentTarget as any; if (v.latencyHint !== undefined) v.latencyHint = "realtime" }}
      />
      {muted && status === "playing" && (
        <button
          onClick={() => setMuted(false)}
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
