import { NextRequest, NextResponse } from "next/server"

const MEDIAMTX_BASE = process.env.MEDIAMTX_WEBRTC ?? "http://127.0.0.1:8889"

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, PATCH, DELETE",
      "Access-Control-Allow-Headers": "*",
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const pathStr = path.join("/")
  const body = await req.arrayBuffer()
  const upstream = await fetch(`${MEDIAMTX_BASE}/${pathStr}/whip`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("Content-Type") || "application/sdp",
    },
    body,
  })
  const resBody = await upstream.arrayBuffer()
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/sdp",
      "Access-Control-Allow-Origin": "*",
      "Location": upstream.headers.get("Location") || "",
    },
  })
}
