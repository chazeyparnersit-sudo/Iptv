"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Radio, Square, AlertCircle, Loader2 } from "lucide-react"
import { whipUrl } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

// getDisplayMedia works on localhost and local-network IPs over HTTP in modern
// browsers (Chrome, Edge, Firefox). HTTPS is not required on private networks.

export type BroadcastState =
  | "idle"
  | "requesting"
  | "connecting"
  | "live"
  | "stopped"
  | "error"

interface WhipBroadcasterProps {
  channelPath: string
  channelName: string
}

const stateLabels: Record<BroadcastState, string> = {
  idle: "Listo",
  requesting: "Solicitando permiso…",
  connecting: "Conectando…",
  live: "En vivo",
  stopped: "Detenido",
  error: "Error",
}

const stateBadgeClass: Record<BroadcastState, string> = {
  idle: "border-slate-200 bg-slate-50 text-slate-600",
  requesting: "border-amber-200 bg-amber-50 text-amber-700",
  connecting: "border-blue-200 bg-blue-50 text-blue-700",
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  stopped: "border-slate-200 bg-slate-50 text-slate-500",
  error: "border-red-200 bg-red-50 text-red-700",
}

async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return
  await new Promise<void>((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check)
        resolve()
      }
    }
    pc.addEventListener("icegatheringstatechange", check)
    setTimeout(resolve, 1500)
  })
}

export function WhipBroadcaster({ channelPath, channelName }: WhipBroadcasterProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<BroadcastState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const kickPublisher = useCallback(async () => {
    try {
      await fetch("/api/mediamtx/kick-publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelPath }),
      })
    } catch {
      // Best-effort — local cleanup still proceeds
    }
  }, [channelPath])

  const stopBroadcast = useCallback(
    async (nextState: BroadcastState = "stopped") => {
      cleanup()
      setState(nextState)
    },
    [cleanup],
  )

  const startBroadcast = useCallback(async () => {
    setErrorMessage(null)
    setState("requesting")

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          void stopBroadcast("stopped")
        })
      }

      setState("connecting")

      const iceRes = await fetch("/api/ice-servers")
      const iceServers = await iceRes.json()
      const pc = new RTCPeerConnection({ iceServers })

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream)
      }

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState
        if (s === "connected") setState("live")
        if (s === "failed" || s === "disconnected") {
          setErrorMessage("Conexión WebRTC perdida")
          void stopBroadcast("error")
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceGathering(pc)

      const res = await fetch(whipUrl(channelPath), {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      })

      if (!res.ok) {
        throw new Error(`WHIP respondió ${res.status}`)
      }

      const answerSdp = await res.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
      setState("live")
    } catch (err) {
      cleanup()
      const msg = (err as Error).message
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setErrorMessage("Permiso de captura de pantalla denegado")
      } else {
        setErrorMessage(msg || "No se pudo iniciar la transmisión")
      }
      setState("error")
    }
  }, [channelPath, cleanup, stopBroadcast])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const isActive = state === "requesting" || state === "connecting" || state === "live"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-slate-800">{channelName}</span>
          <Badge variant="outline" className={stateBadgeClass[state]}>
            {state === "live" && (
              <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            )}
            {state === "connecting" || state === "requesting" ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : null}
            {stateLabels[state]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button
              size="sm"
              onClick={() => void startBroadcast()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Radio className="mr-1.5 h-4 w-4" />
              Iniciar transmisión
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void stopBroadcast()}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Detener
            </Button>
          )}
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-contain"
        />
        {state === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <p className="text-sm text-slate-400">
              Vista previa local — pulsa &quot;Iniciar transmisión&quot;
            </p>
          </div>
        )}
        {(state === "requesting" || state === "connecting") && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
            <p className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stateLabels[state]}
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-slate-400">
        Publicando a{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">
          {whipUrl(channelPath)}
        </code>
      </p>
    </div>
  )
}
