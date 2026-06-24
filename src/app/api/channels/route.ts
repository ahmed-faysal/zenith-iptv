import { NextResponse } from "next/server";
import { getChannels } from "@/lib/source";

export async function GET() {
  try {
    const channels = await getChannels();
    return NextResponse.json({ channels }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return NextResponse.json(
      { channels: [], error: (e as Error).message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
