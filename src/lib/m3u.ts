import type { Channel } from "./types";
import { toAppCategory } from "./categories";

function attr(line: string, key: string): string {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
    const group = attr(line, "group-title");
    const languages = attr(line, "tvg-language").split(";").filter(Boolean);
    const countries = attr(line, "tvg-country").split(";").filter(Boolean);
    const tvgId = attr(line, "tvg-id");

    channels.push({
      id: tvgId || slug(name),
      name,
      logo: attr(line, "tvg-logo"),
      streamUrl: url,
      category: toAppCategory(group ? group.split(";") : []),
      languages,
      countries,
    });
  }
  return channels;
}
