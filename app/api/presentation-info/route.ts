import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const metaPath = path.join(process.cwd(), "public", "presentations", "meta.json")
    const raw = await fs.readFile(metaPath, "utf8")
    const meta = JSON.parse(raw)

    // Para IMAGE_SLIDES, incluir lista de slides
    if (meta.type === "IMAGE_SLIDES") {
      const slidesDir = path.join(process.cwd(), "public", "presentations", "slides")
      try {
        const files = (await fs.readdir(slidesDir))
          .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map(f => `/presentations/slides/${f}`)
        return NextResponse.json({ exists: true, ...meta, slides: files })
      } catch {
        return NextResponse.json({ exists: true, ...meta, slides: [] })
      }
    }

    return NextResponse.json({ exists: true, ...meta })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
