import type { Channel } from "./types";
import { MAX_SOURCES } from "./enrich";

// http:// streams are blocked by the browser on our HTTPS origin; upgrade to
// https:// so TLS-capable servers play (others fail and the player fails over).
export function httpsUpgrade(url: string): string {
  return url.startsWith("http://") ? "https://" + url.slice("http://".length) : url;
}

// Normalize a name for fuzzy cross-source identity: lowercase, drop
// resolution/quality tokens and non-alphanumerics ("ESPN HD" -> "espn").
const QUALITY = /\b(?:\d{3,4}p|[0-9]+k|hd|sd|fhd|uhd|hq|lq)\b/g;
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(QUALITY, " ").replace(/[^\p{L}\p{N}]+/gu, "");
}

// Merge identity: a real tvg-id (contains ".", e.g. "CNN.us") is the strong
// signal; else normalized name + primary country.
export function identityKey(c: Channel): string {
  if (c.id.includes(".")) return `id:${c.id}`;
  return `name:${normalizeName(c.name)}|${c.countries[0] ?? ""}`;
}

function capUrls(urls: string[]): string[] {
  return [...new Set(urls)].slice(0, MAX_SOURCES);
}

// Merge channels from several sources (priority order) into one catalogue. Same
// identity -> one channel; streamUrls = union (https-upgraded, deduped, capped).
// First source wins metadata; later ones fill only blank fields.
export function mergeSources(lists: Channel[][]): Channel[] {
  const byKey = new Map<string, Channel>();
  const order: string[] = [];
  for (const list of lists) {
    for (const c of list) {
      const key = identityKey(c);
      const existing = byKey.get(key);
      if (!existing) {
        order.push(key);
        byKey.set(key, {
          ...c,
          streamUrls: capUrls(c.streamUrls.map(httpsUpgrade)),
          languages: [...c.languages],
          countries: [...c.countries],
        });
        continue;
      }
      existing.streamUrls = capUrls([...existing.streamUrls, ...c.streamUrls.map(httpsUpgrade)]);
      if (!existing.logo && c.logo) existing.logo = c.logo;
      if (existing.languages.length === 0 && c.languages.length) existing.languages = [...c.languages];
      if (existing.countries.length === 0 && c.countries.length) existing.countries = [...c.countries];
      if (existing.category === "Other" && c.category !== "Other") existing.category = c.category;
    }
  }
  return order.map((k) => byKey.get(k)!);
}
