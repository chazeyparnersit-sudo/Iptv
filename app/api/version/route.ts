import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

// Next.js genera .next/BUILD_ID con un hash único en cada `next build`.
// La TV lo consulta periódicamente (ver tv-client.tsx) y si cambia respecto
// al que tenía al cargar la página, significa que hubo un deploy nuevo ->
// se recarga sola, sin que alguien tenga que ir físicamente a refrescarla.
export async function GET() {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe", "tv")
  if (authError) return authError
  try {
    const buildId = (await fs.readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim()
    return NextResponse.json({ buildId })
  } catch {
    return NextResponse.json({ buildId: null })
  }
}
