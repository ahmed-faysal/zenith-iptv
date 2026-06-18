// Builds the iptv-org/epg grabber's `--channels` input: a <channels> doc listing
// only the channels we surface that also have a guide mapping in guides.json.
// Scoping here is what keeps the generated guide small (most channels have no
// guide at all). Used by scripts/build-epg-channels.ts in CI.

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

export function toChannelsXml(guides: GuideEntry[], ids: Set<string>): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const g of guides) {
    if (!ids.has(g.channel)) continue;
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
