import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { Readable } from "stream"

export const dynamic = "force-dynamic"

const PRESENTATIONS_DIR = path.join(process.cwd(), "public", "presentations")

async function saveMeta(type: string, originalName: string, extra: Record<string, unknown> = {}) {
  await fs.mkdir(PRESENTATIONS_DIR, { recursive: true })
  const meta = { type, originalName, uploadedAt: new Date().toISOString(), ...extra }
  await fs.writeFile(path.join(PRESENTATIONS_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf8")
  return meta
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null

    if (!file || !type) {
      return NextResponse.json({ error: "Missing file or type" }, { status: 400 })
    }

    await fs.mkdir(PRESENTATIONS_DIR, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())

    if (type === "PDF") {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
      }
      await fs.writeFile(path.join(PRESENTATIONS_DIR, "presentation.pdf"), buffer)
      const meta = await saveMeta("PDF", file.name)
      return NextResponse.json({ ok: true, ...meta })
    }

    if (type === "VIDEO_LOOP") {
      if (!file.type.startsWith("video/")) {
        return NextResponse.json({ error: "File must be a video" }, { status: 400 })
      }
      // Guardar con extensión original
      const ext = file.name.split(".").pop() ?? "mp4"
      const filename = `video.${ext}`
      await fs.writeFile(path.join(PRESENTATIONS_DIR, filename), buffer)
      const meta = await saveMeta("VIDEO_LOOP", file.name, { filename })
      return NextResponse.json({ ok: true, ...meta })
    }

    if (type === "IMAGE_SLIDES") {
      if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
        return NextResponse.json({ error: "File must be a ZIP" }, { status: 400 })
      }
      // Limpiar carpeta slides anterior
      const slidesDir = path.join(PRESENTATIONS_DIR, "slides")
      await fs.rm(slidesDir, { recursive: true, force: true })
      await fs.mkdir(slidesDir, { recursive: true })

      // Descomprimir ZIP con adm-zip
      const AdmZip = (await import("adm-zip")).default
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => !e.isDirectory && /\.(png|jpg|jpeg|webp)$/i.test(e.entryName))
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))

      if (entries.length === 0) {
        return NextResponse.json({ error: "ZIP contains no valid images (PNG/JPG)" }, { status: 400 })
      }

      // Guardar imágenes numeradas: 001.png, 002.png, ...
      for (let i = 0; i < entries.length; i++) {
        const ext = entries[i].entryName.split(".").pop()
        const filename = String(i + 1).padStart(3, "0") + "." + ext
        await fs.writeFile(path.join(slidesDir, filename), entries[i].getData())
      }

      const meta = await saveMeta("IMAGE_SLIDES", file.name, { slideCount: entries.length })
      return NextResponse.json({ ok: true, ...meta })
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })

  } catch (err) {
    console.error("upload-media error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
