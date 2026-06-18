import { gunzipSync } from "node:zlib";
import { buildGuide, type Programme } from "./epg";

// Server-side cached EPG source, mirroring source.ts: fetch the slim guide built
// in CI, gunzip if needed, parse to a Map<channelId, Programme[]>, cache 1h. When
// EPG_GUIDE_URL is unset (no remote/publish location yet) or the fetch fails, the
// guide is empty — the feature stays dormant instead of erroring.

const TTL_MS = 60 * 60 * 1000; // 1 hour

type Guide = Map<string, Programme[]>;
type Fetcher = (url: string) => Promise<ArrayBuffer>;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`epg fetch failed: ${res.status}`);
  return res.arrayBuffer();
};

function decode(url: string, buf: ArrayBuffer): string {
  const bytes = Buffer.from(buf);
  // Gzip magic 0x1f 0x8b, or a .gz URL — gunzip; otherwise treat as plain XML.
  const gzipped = url.endsWith(".gz") || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  return (gzipped ? gunzipSync(bytes) : bytes).toString("utf8");
}

export function createEpgSource(
  url: string | undefined = process.env.EPG_GUIDE_URL,
  fetcher: Fetcher = defaultFetcher,
) {
  let cache: { guide: Guide; at: number } | null = null;
  return async (): Promise<Guide> => {
    if (!url) return new Map();
    if (cache && Date.now() - cache.at < TTL_MS) return cache.guide;
    try {
      const guide = buildGuide(decode(url, await fetcher(url)));
      cache = { guide, at: Date.now() };
      return guide;
    } catch {
      // Keep last-good guide if we have one; otherwise empty (dormant).
      return cache?.guide ?? new Map();
    }
  };
}

export const getGuide = createEpgSource();
