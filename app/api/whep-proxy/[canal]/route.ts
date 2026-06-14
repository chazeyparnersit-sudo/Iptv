import { NextRequest, NextResponse } from "next/server"

const MEDIAMTX_BASE = process.env.MEDIAMTX_WEBRTC ?? "http://127.0.0.1:8889"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  const { canal } = await params
  const body = await req.text()
  const upstream = await fetch(`${MEDIAMTX_BASE}/${canal}/whep`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("Content-Type") || "application/sdp",
    },
    body,
  })
  const responseBody = await upstream.text()
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/sdp",
      Location: upstream.headers.get("Location") || "",
    },
  })
}
