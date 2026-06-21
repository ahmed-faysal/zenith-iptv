import type { Channel } from "./types";
import { toAppCategory } from "./categories";

function attr(line: string, key: string): string {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

function slug(name: string): string {
  // Keep letters/numbers from any script (\p{L}\p{N}) so non-Latin names (e.g.
  // CJK) don't collapse to a stray quality tag like "576p" or an empty string.
  return name.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXTINF")) continue;

    const url = (lines[i + 1] ?? "").trim();
    if (!url || url.startsWith("#")) continue;

    const name = line.slice(line.lastIndexOf(",") + 1).trim();
    const id = attr(line, "tvg-id") || slug(name);
    if (!id) continue;

    const group = attr(line, "group-title");
    const languages = attr(line, "tvg-language").split(";").filter(Boolean);
    const countries = attr(line, "tvg-country").split(";").filter(Boolean);

    channels.push({
      id,
      name,
      logo: attr(line, "tvg-logo"),
      streamUrls: [url],
      category: toAppCategory(group ? group.split(";") : []),
      languages,
      countries,
      quality: null,
    });
  }
  return channels;
}
