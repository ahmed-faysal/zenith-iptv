import { NextResponse, type NextRequest } from "next/server";
import { getChannels } from "@/lib/source";
import { decideProxy } from "@/lib/proxy-gate";
import type { Channel } from "@/lib/types";

// Memoized Set of catalogue stream URLs, rebuilt only when the channel list ref
// changes (getChannels is cached server-side for an hour).
let cache: { ref: Channel[]; set: Set<string> } | null = null;
function channelUrlSet(channels: Channel[]): Set<string> {
  if (cache?.ref === channels) return cache.set;
  const set = new Set<string>();
  for (const c of channels) for (const u of c.streamUrls) set.add(u);
  cache = { ref: channels, set };
  return set;
}

// Best-effort per-instance fixed-window rate limit (Cloudflare/Vercel back it up).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  e.count++;
  return e.count > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  const channels = await getChannels().catch(() => [] as Channel[]);
  const ip = (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0].trim();
  const res = await decideProxy({
    target: req.nextUrl.searchParams.get("url"),
    origin: req.headers.get("origin") ?? req.headers.get("referer") ?? "",
    self: req.nextUrl.origin,
    channelUrls: channelUrlSet(channels),
    secret: process.env.STREAM_PROXY_SECRET,
    workerUrl: process.env.STREAM_PROXY_WORKER_URL,
    limited: rateLimited(ip),
  });
  if (res.status === 302 && res.location) return NextResponse.redirect(res.location, 302);
  return new NextResponse(res.body ?? "", { status: res.status });
}
