"use client"

export const HEARTBEAT_TIMEOUT_MS = 15000

export const MEDIAMTX_WEBRTC_BASE =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8889`
    : "http://127.0.0.1:8889"

export function whepUrl(path: string): string {
  if (process.env.NEXT_PUBLIC_MEDIAMTX_WHEP_BASE) {
    return `/api/whep-proxy/${path}`
  }
  return typeof window !== "undefined"
    ? `http://${window.location.hostname}:8889/${path}/whep`
    : `http://127.0.0.1:8889/${path}/whep`
}

export function whipUrl(path: string): string {
  if (process.env.NEXT_PUBLIC_MEDIAMTX_WHIP_BASE) {
    return `/api/whip-proxy/${path}`
  }
  return typeof window !== "undefined"
    ? `http://${window.location.hostname}:8889/${path}/whip`
    : `http://127.0.0.1:8889/${path}/whip`
}
