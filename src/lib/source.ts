import type { Channel } from "./types";
import { parseM3U } from "./m3u";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

// Factory so tests get an isolated TTL cache without a production reset hook.
export function createChannelSource(fetcher: Fetcher = defaultFetcher) {
  let cache: { channels: Channel[]; at: number } | null = null;
  return async (): Promise<Channel[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
    const text = await fetcher(PLAYLIST_URL);
    const channels = parseM3U(text);
    cache = { channels, at: Date.now() };
    return channels;
  };
}

export const getChannels = createChannelSource();
