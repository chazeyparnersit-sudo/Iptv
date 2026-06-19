import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

const PRESENTATIONS_DIR = path.join(process.cwd(), "public", "presentations")
const MAX_BYTES = 200 * 1024 * 1024

async function saveMeta(tvId: number, type: string, originalName: string, extra: Record<string, unknown> = {}) {
  const dir = path.join(PRESENTATIONS_DIR, `tv-${tvId}`)
  await fs.mkdir(dir, { recursive: true })
  const meta = { type, originalName, uploadedAt: new Date().toISOString(), ...extra }
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8")
  return meta
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh")
  if (authError) return authError
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null
    const tvIdsRaw = formData.get("tvIds") as string | null
    if (!file || !type || !tvIdsRaw) return NextResponse.json({ error: "Missing file, type or tvIds" }, { status: 400 })
    const tvIds: number[] = JSON.parse(tvIdsRaw)
    if (!Array.isArray(tvIds) || tvIds.length === 0) return NextResponse.json({ error: "tvIds must be a non-empty array" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Archivo demasiado grande (máx 200MB)" }, { status: 413 })
    const buffer = Buffer.from(await file.arrayBuffer())

    if (type === "PDF") {
      if (file.type !== "application/pdf") return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
      const metas = await Promise.all(tvIds.map(async (tvId) => {
        const dir = path.join(PRESENTATIONS_DIR, `tv-${tvId}`)
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(path.join(dir, "presentation.pdf"), buffer)
        return saveMeta(tvId, "PDF", file.name)
      }))
      return NextResponse.json({ ok: true, ...metas[0] })
    }

    if (type === "VIDEO_LOOP") {
      if (!file.type.startsWith("video/")) return NextResponse.json({ error: "File must be a video" }, { status: 400 })
      const ext = file.name.split(".").pop() ?? "mp4"
      const filename = `video.${ext}`
      const metas = await Promise.all(tvIds.map(async (tvId) => {
        const dir = path.join(PRESENTATIONS_DIR, `tv-${tvId}`)
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(path.join(dir, filename), buffer)
        return saveMeta(tvId, "VIDEO_LOOP", file.name, { filename })
      }))
      return NextResponse.json({ ok: true, ...metas[0] })
    }

    if (type === "IMAGE_SLIDES") {
      if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
        return NextResponse.json({ error: "File must be a ZIP" }, { status: 400 })
      }
      const AdmZip = (await import("adm-zip")).default
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => {
          if (e.isDirectory) return false
          const dest = path.resolve("/tmp", path.basename(e.entryName))
          return /\.(png|jpg|jpeg|webp)$/i.test(e.entryName)
        })
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))
      if (entries.length === 0) return NextResponse.json({ error: "ZIP contains no valid images (PNG/JPG)" }, { status: 400 })
      const metas = await Promise.all(tvIds.map(async (tvId) => {
        const slidesDir = path.join(PRESENTATIONS_DIR, `tv-${tvId}`, "slides")
        await fs.rm(slidesDir, { recursive: true, force: true })
        await fs.mkdir(slidesDir, { recursive: true })
        for (let i = 0; i < entries.length; i++) {
          const ext = entries[i].entryName.split(".").pop()
          const filename = String(i + 1).padStart(3, "0") + "." + ext
          await fs.writeFile(path.join(slidesDir, filename), entries[i].getData())
        }
        return saveMeta(tvId, "IMAGE_SLIDES", file.name, { slideCount: entries.length })
      }))
      return NextResponse.json({ ok: true, ...metas[0] })
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (err) {
    console.error("upload-media error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
