import { NextResponse } from "next/server"
import { MEDIAMTX_API_BASE } from "@/lib/config"
import { requireRole } from "@/lib/guard"

export const dynamic = "force-dynamic"

// Proxies the MediaMTX control API to report which paths are live.
// Returns: { paths: { [pathName]: { ready: boolean } }, reachable: boolean }
export async function GET() {
  const { error: authError } = await requireRole("admin", "rrhh", "jefe")
  if (authError) return authError

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${MEDIAMTX_API_BASE}/v3/paths/list`, {
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ paths: {}, reachable: false })
    }

    const data = await res.json()
    const paths: Record<string, { ready: boolean; tracks?: string[] }> = {}
    for (const item of data.items ?? []) {
      paths[item.name] = {
        ready: Boolean(item.ready),
        tracks: item.tracks ?? [],
      }
    }
    return NextResponse.json({ paths, reachable: true })
  } catch {
    // MediaMTX unreachable (e.g. running in cloud preview) — report gracefully
    return NextResponse.json({ paths: {}, reachable: false })
  }
}
