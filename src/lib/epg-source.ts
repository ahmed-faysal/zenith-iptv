import { parseEpgForChannel } from "./epg";
import type { EpgEntry } from "./types";

const EPG_URL = "https://iptv-org.github.io/epg/guides/full.xml";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

type Cache = { xml: string; at: number } | null;
let cache: Cache = null;

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`epg fetch failed: ${res.status}`);
  return res.text();
};

async function getXml(fetcher: Fetcher = defaultFetcher): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.xml;
  const xml = await fetcher(EPG_URL);
  cache = { xml, at: Date.now() };
  return xml;
}

export async function getEpg(channelId: string): Promise<EpgEntry> {
  const xml = await getXml();
  return parseEpgForChannel(xml, channelId, new Date());
}
