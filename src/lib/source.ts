import type { Channel } from "./types";
import { parseM3U } from "./m3u";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type Cache = { channels: Channel[]; at: number } | null;
let cache: Cache = null;

export function __resetCache(): void { cache = null; }

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

export async function getChannels(
  fetcher: Fetcher = (url) => defaultFetcher(url)
): Promise<Channel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
  const text = await fetcher(PLAYLIST_URL);
  const channels = parseM3U(text);
  cache = { channels, at: Date.now() };
  return channels;
}
