import { NextResponse } from "next/server";
import { getGuide } from "@/lib/epg-source";
import { nowNext, type NowNext } from "@/lib/epg";

// Now/next per channel, computed at request time from the cached schedule so the
// answer is always current even if the guide file is hours old. Channels with no
// current or upcoming programme are omitted; an unconfigured guide yields {}.
export async function GET() {
  try {
    const guide = await getGuide();
    const at = Date.now();
    const out: Record<string, NowNext> = {};
    for (const [id, programmes] of guide) {
      const nn = nowNext(programmes, at);
      if (nn.now || nn.next) out[id] = nn;
    }
    return NextResponse.json({ epg: out }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return NextResponse.json(
      { epg: {}, error: (e as Error).message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
