import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ])
}
