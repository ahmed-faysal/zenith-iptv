import type { Channel } from "./types";
import { parseM3U } from "./m3u";
import { applyEnrichment, type EnrichmentMap } from "./enrich";
import { mergeSources } from "./merge";
import { SOURCES, applyDefaults, type Source } from "./sources";
import enrichment from "@/data/enrichment.json";

const TTL_MS = 60 * 60 * 1000; // 1 hour

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

// Fetch every source in parallel; a failed source is logged and skipped so one
// bad URL never breaks the catalogue. Parse + apply per-source defaults, merge
// (identity union of streamUrls), then enrich. Cached for an hour.
export function createChannelSource(
  fetcher: Fetcher = defaultFetcher,
  sources: Source[] = SOURCES,
) {
  let cache: { channels: Channel[]; at: number } | null = null;
  return async (): Promise<Channel[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;

    const results = await Promise.allSettled(sources.map((s) => fetcher(s.url)));
    const lists: Channel[][] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        lists.push(applyDefaults(parseM3U(r.value), sources[i]));
      } else {
        console.warn(`[source] ${sources[i].label} failed:`, r.reason);
      }
    });
    if (lists.length === 0) throw new Error("all playlist sources failed");

    const channels = applyEnrichment(mergeSources(lists), enrichment as EnrichmentMap);
    cache = { channels, at: Date.now() };
    return channels;
  };
}

export const getChannels = createChannelSource();
