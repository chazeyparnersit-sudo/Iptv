import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      `https://chazeyparnersi.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
    );

    if (!res.ok) {
      throw new Error(`Metered API error: ${res.status}`);
    }

    const iceServers = await res.json();
    return NextResponse.json(iceServers);
  } catch (err) {
    console.error("[ice-servers] Error fetching credentials:", err);
    return NextResponse.json([
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "2ea23b4f02e90b309ed3fc59",
        credential: "XDNG0DOpFYrS3WSB",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "2ea23b4f02e90b309ed3fc59",
        credential: "XDNG0DOpFYrS3WSB",
      },
    ]);
  }
}
