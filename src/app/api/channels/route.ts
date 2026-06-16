import { NextResponse } from "next/server";
import { getChannels } from "@/lib/source";

export async function GET() {
  try {
    const channels = await getChannels();
    return NextResponse.json({ channels });
  } catch (e) {
    return NextResponse.json(
      { channels: [], error: (e as Error).message },
      { status: 502 }
    );
  }
}
