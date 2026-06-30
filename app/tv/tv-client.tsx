"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { WhepPlayer } from "@/components/whep-player"
import type { ResolvedAssignment } from "@/lib/types"

export function TvClient() {
  const params = useSearchParams()
  const router = useRouter()
  const tv = Number(params.get("tv") ?? "1")

  const [assignment, setAssignment] = useState<ResolvedAssignment | null>(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Desbloqueo de audio: los navegadores exigen UN gesto humano (el que sea)
  // antes de permitir audio en autoplay. Antes esto se resolvía tocando un
  // botón específico dentro del reproductor; en una Smart TV manejada con
  // control remoto eso es incómodo (hay que ir físicamente hasta la pantalla).
  // Escuchamos CUALQUIER tecla/click/touch en toda la página -> un solo
  // botón del control (aunque sea "volver" o una flecha) desbloquea el audio
  // para el resto de la sesión, sin que el usuario tenga que apuntarle a un
  // botón en particular.
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  useEffect(() => {
    if (audioUnlocked) return
    function unlock() { setAudioUnlocked(true) }
    window.addEventListener("keydown", unlock, { once: true })
    window.addEventListener("pointerdown", unlock, { once: true })
    return () => {
      window.removeEventListener("keydown", unlock)
      window.removeEventListener("pointerdown", unlock)
    }
  }, [audioUnlocked])

  // Restaurar último assignment conocido desde localStorage al montar
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`assignment:${tv}`)
      if (cached) setAssignment(JSON.parse(cached))
    } catch { /* ignorar */ }
  }, [tv])

  // Poll assignment + send heartbeat every 5s
  useEffect(() => {
    let active = true

    async function tick() {
      try {
        const res = await fetch(`/api/assignment?tv=${tv}`, { cache: "no-store" })
        if (res.ok && active) {
          const data: ResolvedAssignment = await res.json()
          try { localStorage.setItem(`assignment:${tv}`, JSON.stringify(data)) } catch { /* ignorar */ }
          setAssignment((prev) => {
            if (
              prev &&
              prev.sourceType === data.sourceType &&
              prev.sourceUrl === data.sourceUrl &&
              prev.content === data.content &&
              prev.bgColor === data.bgColor &&
              prev.textColor === data.textColor &&
              prev.channelName === data.channelName
            ) {
              return prev
            }
            return data
          })
        }
      } catch {
        // ignore transient errors
      }
    }

    tick()
    const id = setInterval(tick, 5000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [tv])

  function handleMouseMove() {
    setShowOverlay(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowOverlay(false), 2500)
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
    >
      <Content assignment={assignment} audioUnlocked={audioUnlocked} />

      <div
        className={`pointer-events-none absolute bottom-4 left-4 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition-opacity duration-300 ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        {assignment?.channelName ?? `TV ${tv}`}
      </div>

      <button
        onClick={() => router.push("/")}
        aria-label="Volver al inicio"
        className={`absolute left-4 top-4 flex items-center gap-1.5 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition-opacity duration-300 hover:text-white ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
    </main>
  )
}

// ---------------------------------------------------------------------------
// CanvaSlideshow — avanza diapositivas automáticamente cada SLIDE_DURATION ms
// ---------------------------------------------------------------------------
const SLIDE_DURATION = 5000 // 5 segundos por diapositiva

function CanvaSlideshow({ url }: { url: string }) {
  const [slide, setSlide] = useState(1)
  const totalSlides = useRef(14) // valor por defecto

  // Leer ?slides=N de la URL si existe
  useEffect(() => {
    try {
      const u = new URL(url)
      const s = u.searchParams.get("slides")
      if (s) totalSlides.current = parseInt(s, 10)
    } catch {
      // usar default
    }
    setSlide(1) // reiniciar al montar o cambiar URL
  }, [url])

  // Avanzar diapositiva cada SLIDE_DURATION ms
  useEffect(() => {
    const id = setInterval(() => {
      setSlide((prev) => (prev >= totalSlides.current ? 1 : prev + 1))
    }, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [url])

  const embedUrl = buildCanvaSlideUrl(url, slide)

  // NOTA (B6, investigado 2026-06): el embed público de Canva (.../view?embed) no expone
  // ninguna API de postMessage para controlar la navegación interna desde la página padre,
  // y los iframes no re-leen su propio `src` en caliente al cambiar solo el query param.
  // El remount via `key={embedUrl}` es la única forma conocida de forzar el avance automático
  // de diapositiva sin depender de la Canva Connect API (requiere OAuth, fuera de alcance).
  // Esto implica una recarga de red completa por slide; es una limitación del proveedor,
  // no un bug de esta implementación. Evaluado y descartado: cross-fade con doble iframe
  // (mitiga el parpadeo pero duplica la carga de red, empeora el problema de fondo).
  return (
    <iframe
      key={embedUrl}
      src={embedUrl}
      title="Presentación Canva"
      allow="fullscreen; autoplay"
      allowFullScreen
      className="h-full w-full border-0"
    />
  )
}

/** Construye la URL de embed para una diapositiva específica */
function buildCanvaSlideUrl(url: string, slide: number): string {
  if (!url) return url
  try {
    const u = new URL(url)
    // Asegurar que es canva.com
    if (!u.hostname.includes("canva.com")) return url
    // Limpiar params que no necesita el embed
    u.searchParams.delete("slides") // nuestro param interno
    // Agregar slide y embed
    u.searchParams.set("slide", String(slide))
    // Asegurar que tiene ?embed
    if (!u.searchParams.has("embed")) {
      u.searchParams.set("embed", "")
    }
    return u.toString().replace(/embed=$/, "embed")
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// PdfSlideshow — renderiza un PDF página a página con autoplay
// ---------------------------------------------------------------------------
const PDF_SLIDE_DURATION = 5000  // ms por página
const PDF_POLL_INTERVAL  = 60000 // ms para detectar PDF nuevo

function PdfSlideshow({ tvId }: { tvId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pdfRef = useRef<unknown>(null)
  const renderingRef = useRef(false)
  const uploadedAtRef = useRef<string | null>(null)

  // Cargar (o recargar) el PDF
  async function loadPdf(url: string) {
    // Destruir el PDF anterior para liberar memoria
    if (pdfRef.current) {
      try {
        await (pdfRef.current as { destroy: () => Promise<void> }).destroy()
      } catch { /* ignorar */ }
      pdfRef.current = null
    }
    const pdfjsLib = await import("pdfjs-dist")
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
    const pdf = await pdfjsLib.getDocument({ url }).promise
    pdfRef.current = pdf
    setTotalPages(pdf.numPages)
    setPage(1)
  }

  // Carga inicial
  useEffect(() => {
    loadPdf(`/presentations/tv-${tvId}/presentation.pdf?t=${Date.now()}`)
  }, [])

  // Polling para detectar PDF nuevo
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/presentation-info?tvId=${tvId}`, { cache: "no-store" })
        const data = await res.json()
        if (data.exists && data.uploadedAt && data.uploadedAt !== uploadedAtRef.current) {
          uploadedAtRef.current = data.uploadedAt
          await loadPdf(`/presentations/tv-${tvId}/presentation.pdf?t=${Date.now()}`)
        }
      } catch {
        // ignorar
      }
    }, PDF_POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  // Renderizar página actual en canvas
  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current) return

    let cancelled = false

    async function render() {
      // Si hay un render en curso, esperar a que termine y reintentar
      if (renderingRef.current) {
        await new Promise<void>((resolve) => {
          const poll = setInterval(() => {
            if (!renderingRef.current) { clearInterval(poll); resolve() }
          }, 50)
        })
        if (cancelled) return
      }

      renderingRef.current = true
      try {
        const pdf = pdfRef.current as { getPage: (n: number) => Promise<unknown> }
        const pdfPage = await pdf.getPage(page) as {
          getViewport: (o: { scale: number }) => { width: number; height: number }
          render: (ctx: unknown) => { promise: Promise<void>; cancel?: () => void }
        }
        if (cancelled) return
        const canvas = canvasRef.current!
        const ctx = canvas.getContext("2d")!
        const viewport = pdfPage.getViewport({ scale: 1 })
        const scale = Math.min(
          window.innerWidth / viewport.width,
          window.innerHeight / viewport.height
        )
        const scaled = pdfPage.getViewport({ scale })
        canvas.width = scaled.width
        canvas.height = scaled.height
        const renderTask = pdfPage.render({ canvasContext: ctx, viewport: scaled })
        if (cancelled) { renderTask.cancel?.(); return }
        await renderTask.promise
      } finally {
        renderingRef.current = false
      }
    }

    render()
    return () => { cancelled = true }
  }, [page])

  // Autoplay
  useEffect(() => {
    const id = setInterval(() => {
      setPage((prev) => (prev >= totalPages ? 1 : prev + 1))
    }, PDF_SLIDE_DURATION)
    return () => clearInterval(id)
  }, [totalPages])

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// VideoLoopPlayer — <video> en loop con volumen controlable desde el admin.
// Antes el <video> tenía `muted` fijo en el JSX (sin forma de cambiarlo). Los
// navegadores bloquean autoplay con sonido sin gesto del usuario, así que
// arrancamos muted=true (requisito para autoplay) y, si el volumen pedido es
// > 0, intentamos desmutear apenas el video está listo. Si el navegador lo
// bloquea (kiosko sin flags de autoplay), se degrada a silencioso sin romper
// la reproducción, igual que ya hace WhepPlayer con su overlay de "toca para
// activar audio".
// ---------------------------------------------------------------------------
function VideoLoopPlayer({ src, volume, audioUnlocked }: { src: string; volume: number; audioUnlocked: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.volume = Math.min(100, Math.max(0, volume)) / 100
    const shouldMute = volume <= 0 || !audioUnlocked
    el.muted = shouldMute
    if (!shouldMute) {
      el.play?.().catch(() => {
        // Autoplay con audio bloqueado por el navegador: se queda muted.
        el.muted = true
      })
    }
  }, [volume, audioUnlocked])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted={volume <= 0 || !audioUnlocked}
      playsInline
      className="h-full w-full object-contain bg-black"
    />
  )
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
function Content({
  assignment,
  audioUnlocked,
}: {
  assignment: ResolvedAssignment | null
  audioUnlocked: boolean
}) {
  if (!assignment) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-neutral-600">Cargando…</p>
      </div>
    )
  }

  switch (assignment.sourceType) {
    case "LIVE":
      return (
        <WhepPlayer
          key={assignment.sourceUrl}
          url={assignment.sourceUrl}
          volume={assignment.volume}
          audioUnlocked={audioUnlocked}
          className="relative h-full w-full"
        />
      )

    case "VIDEO_LOOP":
      return (
        <VideoLoopPlayer
          key={assignment.sourceUrl}
          src={assignment.sourceUrl}
          volume={assignment.volume}
          audioUnlocked={audioUnlocked}
        />
      )

    case "CANVA":
      return <CanvaSlideshow url={assignment.sourceUrl} />

    case "PDF":
      return <PdfSlideshow tvId={assignment.tvId} />

    case "IMAGE_SLIDES":
      return <ImageSlideshow tvId={assignment.tvId} />

    case "ANNOUNCEMENT":
      return (
        <div
          className="flex h-full w-full items-center justify-center px-12 text-center"
          style={{ backgroundColor: assignment.bgColor ?? "#1e3a5f" }}
        >
          <p
            className="text-balance text-5xl font-semibold leading-tight md:text-7xl"
            style={{ color: assignment.textColor ?? "#ffffff" }}
          >
            {assignment.content}
          </p>
        </div>
      )

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// ImageSlideshow — muestra PNGs del ZIP en secuencia
// ---------------------------------------------------------------------------
const IMAGE_SLIDE_DURATION = 5000
const IMAGE_POLL_INTERVAL  = 60000

function ImageSlideshow({ tvId }: { tvId: number }) {
  const [slides, setSlides] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const uploadedAtRef = useRef<string | null>(null)

  async function loadSlides() {
    try {
      const res = await fetch(`/api/presentation-info?tvId=${tvId}`, { cache: "no-store" })
      const data = await res.json()
      if (data.exists && data.type === "IMAGE_SLIDES" && data.slides?.length) {
        uploadedAtRef.current = data.uploadedAt
        setSlides(data.slides.map((s: string) => `${s}?t=${Date.now()}`))
        setIndex(0)
      }
    } catch {
      // ignorar
    }
  }

  useEffect(() => { loadSlides() }, [])

  // Polling para detectar slideshow nuevo
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/presentation-info?tvId=${tvId}`, { cache: "no-store" })
        const data = await res.json()
        if (data.exists && data.uploadedAt && data.uploadedAt !== uploadedAtRef.current) {
          await loadSlides()
        }
      } catch { /* ignorar */ }
    }, IMAGE_POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  // Autoplay
  useEffect(() => {
    if (slides.length === 0) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, IMAGE_SLIDE_DURATION)
    return () => clearInterval(id)
  }, [slides])

  if (slides.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="text-sm text-neutral-500">Sin diapositivas disponibles</p>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <img
        key={slides[index]}
        src={slides[index]}
        alt={`Diapositiva ${index + 1}`}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}