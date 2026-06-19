import { canonicalCategory } from "./categories";
import { baseChannelId } from "./epg";
import type { AppCategory } from "./types";

export type RawLogo = {
  channel: string; feed: string | null; in_use: boolean; tags: string[];
  width: number; height: number; format: string; url: string;
};

const FORMAT_RANK: Record<string, number> = { SVG: 3, WEBP: 2, PNG: 1 };

// Best logo URL for a channel: in-use first, then format (SVG scales for TV),
// then larger area. When `feed` is given, a feed-specific logo outranks the
// channel-level one.
export function bestLogo(logos: RawLogo[], feed?: string | null): string | undefined {
  if (logos.length === 0) return undefined;
  const score = (l: RawLogo): number =>
    (l.in_use ? 1_000_000 : 0) +
    (feed && l.feed === feed ? 500_000 : 0) +
    (FORMAT_RANK[l.format?.toUpperCase()] ?? 0) * 100_000 +
    Math.min(l.width * l.height, 99_999);
  return [...logos].sort((a, b) => score(b) - score(a))[0].url;
}

export type RawChannel = { id: string; country: string | null; categories: string[] };
export type RawStream = { channel: string | null; feed: string | null; quality: string | null };
export type EnrichmentEntry = { category?: AppCategory; country?: string; logo?: string; quality?: string };
export type EnrichmentMap = Record<string, EnrichmentEntry>;

const feedOf = (id: string): string | null => (id.includes("@") ? id.split("@")[1] : null);

export function buildEnrichment(
  m3uIds: string[], channels: RawChannel[], logos: RawLogo[], streams: RawStream[],
): EnrichmentMap {
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const logosByChannel = new Map<string, RawLogo[]>();
  for (const l of logos) {
    const arr = logosByChannel.get(l.channel) ?? [];
    arr.push(l);
    logosByChannel.set(l.channel, arr);
  }
  const streamByKey = new Map<string, RawStream>();
  for (const s of streams) {
    if (s.channel) streamByKey.set(`${s.channel}@${s.feed ?? ""}`, s);
  }

  const map: EnrichmentMap = {};
  for (const id of m3uIds) {
    const base = baseChannelId(id);
    const ch = channelById.get(base);
    if (!ch) continue; // unmapped -> falls back to M3U at runtime
    const feed = feedOf(id);
    const entry: EnrichmentEntry = {};
    const cat = canonicalCategory(ch.categories);
    if (cat) entry.category = cat;
    if (ch.country) entry.country = ch.country;
    const logo = bestLogo(logosByChannel.get(base) ?? [], feed);
    if (logo) entry.logo = logo;
    const quality = streamByKey.get(`${base}@${feed ?? ""}`)?.quality;
    if (quality) entry.quality = quality;
    if (Object.keys(entry).length) map[id] = entry;
  }
  return map;
}
