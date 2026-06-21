import type { AppCategory, Channel } from "./types";

export type Source = {
  label: string;            // provenance / logging
  url: string;
  country?: string;         // ISO code applied to entries missing tvg-country
  language?: string;        // applied to entries missing tvg-language
  category?: AppCategory;   // applied when the parsed category is the "Other" fallback
};

// Curated registry, in priority order. iptv-org is the canonical spine (full
// metadata + enrichment). Add more sources by appending here.
export const SOURCES: Source[] = [
  { label: "iptv-org",   url: "https://iptv-org.github.io/iptv/index.m3u" },
  { label: "free-tv",    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },
  { label: "atsushi-jp", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/jp.m3u", country: "JP", language: "Japanese" },
  { label: "atsushi-tv", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/tv.m3u" },
];

// Fill source-level defaults onto entries that lack them (never override real
// parsed values). Applied to each source's channels after parseM3U.
export function applyDefaults(channels: Channel[], source: Source): Channel[] {
  return channels.map((c) => {
    const next: Channel = { ...c };
    if (next.countries.length === 0 && source.country) next.countries = [source.country];
    if (next.languages.length === 0 && source.language) next.languages = [source.language];
    if (next.category === "Other" && source.category) next.category = source.category;
    return next;
  });
}
