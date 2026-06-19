"use client"
import { useEffect, useRef, useState } from "react"

export default function DiagPage() {
  const [log, setLog] = useState<string[]>([])
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function addLog(msg: string) {
    setLog(prev => [`[${new Date().toISOString().slice(11,23)}] ${msg}`, ...prev].slice(0, 80))
  }

  async function start() {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (intervalRef.current) clearInterval(intervalRef.current)
    setLog([])
    addLog("Iniciando conexión WHEP a canal2...")

    try {
      const iceRes = await fetch("/api/ice-servers")
      const iceServers = await iceRes.json()
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      pc.addTransceiver("video", { direction: "recvonly" })
      pc.addTransceiver("audio", { direction: "recvonly" })

      for (const r of pc.getReceivers()) {
        if ("playoutDelayHint" in r) {
          ;(r as any).playoutDelayHint = 0
          addLog(`playoutDelayHint soportado ✅`)
        } else {
          addLog(`playoutDelayHint NO soportado ❌`)
        }
        if ("jitterBufferTarget" in r) {
          ;(r as any).jitterBufferTarget = 0
          addLog(`jitterBufferTarget soportado ✅`)
        }
      }

      pc.ontrack = (ev) => addLog(`ontrack: ${ev.track.kind}`)

      pc.onconnectionstatechange = () => addLog(`connectionState: ${pc.connectionState}`)
      pc.oniceconnectionstatechange = () => addLog(`iceState: ${pc.iceConnectionState}`)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve()
        const check = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", check); resolve() } }
        pc.addEventListener("icegatheringstatechange", check)
        setTimeout(resolve, 400)
      })

      addLog("Enviando offer a /api/whep-proxy/canal2...")
      const res = await fetch("/api/whep-proxy/canal2", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      })
      addLog(`WHEP response: ${res.status}`)
      if (!res.ok) { addLog("ERROR: WHEP falló"); return }

      const answer = await res.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      addLog("SDP negociado OK")

      // Stats cada 2s
      let lastDelay = 0; let lastCount = 0
      intervalRef.current = setInterval(async () => {
        const stats = await pc.getStats()
        stats.forEach((r: any) => {
          if (r.type === "candidate-pair" && r.state === "succeeded") {
            addLog(`ICE par activo: local=${r.localCandidateId} remote=${r.remoteCandidateId}`)
          }
          if (r.type === "local-candidate") {
            addLog(`localCandidate: ${r.candidateType} ${r.protocol} ${r.address}:${r.port}`)
          }
          if (r.type === "inbound-rtp" && r.kind === "video") {
            const dDelay = r.jitterBufferDelay - lastDelay
            const dCount = r.jitterBufferEmittedCount - lastCount
            lastDelay = r.jitterBufferDelay; lastCount = r.jitterBufferEmittedCount
            const avg = dCount > 0 ? (dDelay / dCount * 1000).toFixed(1) : "?"
            addLog(`video — jitterBuffer: ${avg}ms | lost: ${r.packetsLost} | nack: ${r.nackCount} | fps: ${r.framesPerSecond ?? "?"}`)
          }
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            addLog(`audio — jitterBuffer: ${(r.jitterBufferDelay * 1000).toFixed(1)}ms | lost: ${r.packetsLost}`)
          }
        })
      }, 2000)

    } catch (e: any) {
      addLog(`ERROR: ${e.message}`)
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    addLog("Conexión cerrada.")
  }

  useEffect(() => () => stop(), [])

  return (
    <div style={{ background: "#000", color: "#0f0", fontFamily: "monospace", minHeight: "100vh", padding: 16 }}>
      <h1 style={{ color: "#fff", fontSize: 20, marginBottom: 12 }}>WHEP Diagnóstico</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={start} style={{ background: "#0a0", color: "#fff", padding: "8px 20px", fontSize: 16, border: "none", borderRadius: 6 }}>
          ▶ Conectar
        </button>
        <button onClick={stop} style={{ background: "#a00", color: "#fff", padding: "8px 20px", fontSize: 16, border: "none", borderRadius: 6 }}>
          ■ Detener
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}
