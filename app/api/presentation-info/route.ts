import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export const dynamic = "force-dynamic"

const PRESENTATIONS_DIR = path.join(process.cwd(), "public", "presentations")

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tvId = searchParams.get("tvId")

  const dir = tvId
    ? path.join(PRESENTATIONS_DIR, `tv-${tvId}`)
    : PRESENTATIONS_DIR

  try {
    const raw = await fs.readFile(path.join(dir, "meta.json"), "utf8")
    const meta = JSON.parse(raw)

    if (meta.type === "IMAGE_SLIDES") {
      const slidesDir = path.join(dir, "slides")
      try {
        const files = (await fs.readdir(slidesDir))
          .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map(f => tvId
            ? `/presentations/tv-${tvId}/slides/${f}`
            : `/presentations/slides/${f}`)
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
