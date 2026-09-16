// Builds the iptv-org/epg grabber's `--channels` input: a <channels> doc listing
// only the channels we surface that also have a guide mapping in guides.json.
// Scoping here is what keeps the generated guide small (most channels have no
// guide at all). Used by scripts/build-epg-channels.ts in CI.
import type { Channel } from "./types";
import { baseChannelId } from "./epg";

// Grabber site configs that abort the entire run rather than failing their own
// channel. tv.mail.ru answers rate-limited requests with an HTML challenge page
// that its config feeds straight to JSON.parse, throwing unhandled and killing
// the grab with exit 1 -- which silently stopped the guide updating for 10 days
// (2026-09-06 to 2026-09-16). Excluding a site costs only that site's rows;
// channels it covers are almost always served by another site too.
export const BLOCKED_SITES = new Set(["tv.mail.ru"]);

export type GuideEntry = {
  channel: string; // xmltv_id
  site: string;
  site_id: string;
  lang?: string;
};

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toChannelsXml(
  guides: GuideEntry[],
  ids: Set<string>,
  blocked: Set<string> = BLOCKED_SITES,
): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const g of guides) {
    if (!ids.has(g.channel)) continue;
    if (blocked.has(g.site)) continue;
    const key = `${g.channel}|${g.site}|${g.site_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lang = g.lang ? ` lang="${escapeAttr(g.lang)}"` : "";
    rows.push(
      `  <channel site="${escapeAttr(g.site)}"${lang} ` +
        `xmltv_id="${escapeAttr(g.channel)}" site_id="${escapeAttr(g.site_id)}">` +
        `${escapeAttr(g.channel)}</channel>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${rows.join("\n")}\n</channels>\n`;
}

// Which channel ids (base xmltv_id, no @feed suffix) the guide should cover,
// optionally narrowed to a set of country codes. `channels` should be whatever
// the app actually serves (see resolveCatalogue) so the guide never carries
// entries for channels nobody will see.
export function scopeChannelIds(channels: Channel[], countries: string[]): Set<string> {
  const upper = countries.map((c) => c.toUpperCase());
  const scoped = upper.length
    ? channels.filter((c) => c.countries.some((x) => upper.includes(x.toUpperCase())))
    : channels;
  return new Set(scoped.map((c) => baseChannelId(c.id)));
}
