import { NextResponse } from "next/server";
import { getEpg } from "@/lib/epg-source";

export async function GET(req: Request) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getEpg(channelId));
  } catch {
    return NextResponse.json({}, { status: 200 }); // EPG is best-effort
  }
}
