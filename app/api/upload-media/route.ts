import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

const PRESENTATIONS_DIR = path.join(process.cwd(), "public", "presentations")
const MAX_BYTES = 200 * 1024 * 1024

async function saveMeta(type: string, originalName: string, extra: Record<string, unknown> = {}) {
  await fs.mkdir(PRESENTATIONS_DIR, { recursive: true })
  const meta = { type, originalName, uploadedAt: new Date().toISOString(), ...extra }
  await fs.writeFile(path.join(PRESENTATIONS_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf8")
  return meta
}

export async function POST(req: Request) {
  const { error: authError } = await requireRole("admin", "rrhh")
  if (authError) return authError
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null
    if (!file || !type) return NextResponse.json({ error: "Missing file or type" }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Archivo demasiado grande (máx 200MB)" }, { status: 413 })
    await fs.mkdir(PRESENTATIONS_DIR, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    if (type === "PDF") {
      if (file.type !== "application/pdf") return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
      await fs.writeFile(path.join(PRESENTATIONS_DIR, "presentation.pdf"), buffer)
      return NextResponse.json({ ok: true, ...(await saveMeta("PDF", file.name)) })
    }
    if (type === "VIDEO_LOOP") {
      if (!file.type.startsWith("video/")) return NextResponse.json({ error: "File must be a video" }, { status: 400 })
      const ext = file.name.split(".").pop() ?? "mp4"
      const filename = `video.${ext}`
      await fs.writeFile(path.join(PRESENTATIONS_DIR, filename), buffer)
      return NextResponse.json({ ok: true, ...(await saveMeta("VIDEO_LOOP", file.name, { filename })) })
    }
    if (type === "IMAGE_SLIDES") {
      if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
        return NextResponse.json({ error: "File must be a ZIP" }, { status: 400 })
      }
      const slidesDir = path.join(PRESENTATIONS_DIR, "slides")
      await fs.rm(slidesDir, { recursive: true, force: true })
      await fs.mkdir(slidesDir, { recursive: true })
      const AdmZip = (await import("adm-zip")).default
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => {
          if (e.isDirectory) return false
          const dest = path.resolve(slidesDir, path.basename(e.entryName))
          if (!dest.startsWith(path.resolve(slidesDir))) return false
          return /\.(png|jpg|jpeg|webp)$/i.test(e.entryName)
        })
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))
      if (entries.length === 0) return NextResponse.json({ error: "ZIP contains no valid images (PNG/JPG)" }, { status: 400 })
      for (let i = 0; i < entries.length; i++) {
        const ext = entries[i].entryName.split(".").pop()
        const filename = String(i + 1).padStart(3, "0") + "." + ext
        await fs.writeFile(path.join(slidesDir, filename), entries[i].getData())
      }
      return NextResponse.json({ ok: true, ...(await saveMeta("IMAGE_SLIDES", file.name, { slideCount: entries.length })) })
    }
    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (err) {
    console.error("upload-media error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
