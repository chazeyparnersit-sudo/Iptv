import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireRole } from "@/lib/guard"
export const dynamic = "force-dynamic"
const PRESENTATIONS_DIR = path.join(process.cwd(), "public", "presentations")
export async function GET(req: Request) {
  const { error: authError } = await requireRole("tv", "admin", "rrhh", "jefe")
  if (authError) return authError
  const { searchParams } = new URL(req.url)
  const tvIdRaw = searchParams.get("tvId")
  if (tvIdRaw !== null) {
    const tvIdNum = Number(tvIdRaw)
    if (!Number.isInteger(tvIdNum) || tvIdNum <= 0) {
      return NextResponse.json({ error: "invalid tvId" }, { status: 400 })
    }
  }
  const tvId = tvIdRaw !== null ? String(Math.floor(Number(tvIdRaw))) : null
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
