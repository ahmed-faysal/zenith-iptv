import { canonicalCategory } from "./categories";
import { baseChannelId } from "./epg";
import type { AppCategory, Channel } from "./types";

// http:// streams are blocked by the browser on our HTTPS origin; upgrade to
// https:// so TLS-capable servers play (others fail and the player fails over).
export function httpsUpgrade(url: string): string {
  return url.startsWith("http://") ? "https://" + url.slice("http://".length) : url;
}

export type RawLogo = {
  channel: string; feed: string | null; in_use: boolean; tags: string[];
  width: number; height: number; format: string; url: string;
};

// Max stream URLs kept per channel (1 primary + up to 3 backups). Caps the
// stored artifact and the player's failover attempts.
export const MAX_SOURCES = 4;

const dedupe = (arr: string[]): string[] => [...new Set(arr)];

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

export type RawChannel = { id: string; country: string | null; categories: string[]; languages: string[] };
export type RawStream = { channel: string | null; feed: string | null; url: string; quality: string | null };
export type EnrichmentEntry = { category?: AppCategory; country?: string; logo?: string; quality?: string; languages?: string[]; urls?: string[] };
export type EnrichmentMap = Record<string, EnrichmentEntry>;

const feedOf = (id: string): string | null => (id.includes("@") ? id.split("@")[1] : null);

// URLs for a channel, same-feed first (the M3U id's @feed), then others as
// backups; deduped and capped. Other/null-feed streams are still valid backups.
function collectUrls(streams: RawStream[], feed: string | null): string[] {
  const ordered = [
    ...streams.filter((s) => feed != null && s.feed === feed),
    ...streams.filter((s) => feed == null || s.feed !== feed),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of ordered) {
    if (s.url && !seen.has(s.url)) { seen.add(s.url); out.push(s.url); }
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

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
  const streamsByChannel = new Map<string, RawStream[]>();
  for (const s of streams) {
    if (!s.channel) continue;
    const arr = streamsByChannel.get(s.channel) ?? [];
    arr.push(s);
    streamsByChannel.set(s.channel, arr);
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
    const urls = collectUrls(streamsByChannel.get(base) ?? [], feed);
    if (urls.length) entry.urls = urls;
    if (ch.languages?.length) entry.languages = ch.languages;
    if (Object.keys(entry).length) map[id] = entry;
  }
  return map;
}

// Merge enrichment onto channels by id. Enrichment wins where present; the
// channel's M3U-derived value is the fallback. `country` becomes a 1-element
// `countries` array (M3U country is usually empty).
export function applyEnrichment(channels: Channel[], map: EnrichmentMap): Channel[] {
  return channels.map((c) => {
    const e = map[c.id];
    if (!e) return c;
    const streamUrls = e.urls?.length
      ? dedupe([...c.streamUrls, ...e.urls.map(httpsUpgrade)]).slice(0, MAX_SOURCES)
      : c.streamUrls;
    return {
      ...c,
      category: e.category ?? c.category,
      countries: e.country ? [e.country] : c.countries,
      languages: e.languages?.length ? e.languages : c.languages,
      logo: e.logo ?? c.logo,
      quality: e.quality ?? c.quality,
      streamUrls,
    };
  });
}
