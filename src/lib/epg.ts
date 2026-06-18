// XMLTV → "now / next" for the program guide. The slim guide is pre-built in CI
// (see scripts/build-epg-channels.ts + the epg workflow); here we only parse it
// and compute the current/next programme from absolute timestamps, so a guide
// that's a few hours old still resolves "now" correctly.

export type Programme = {
  channel: string; // xmltv_id, matches Channel.id (tvg-id)
  start: number; // epoch ms
  stop: number; // epoch ms
  title: string;
};

export type NowNext = { now?: Programme; next?: Programme };

// Channel.id keeps iptv-org's `@feed` suffix (e.g. "1Plus1International.ua@HD")
// so each feed stays a distinct, routable entry. EPG (guides.json + XMLTV) keys
// on the base xmltv_id without that suffix, so normalise at the join boundary.
export function baseChannelId(id: string): string {
  return id.split("@")[0];
}

// XMLTV time: "YYYYMMDDHHMMSS[ ±HHMM]". Returns epoch ms (NaN if malformed).
export function parseXmltvDate(s: string): number {
  const m = s.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se, tz] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (tz) {
    const sign = tz[0] === "-" ? -1 : 1;
    const offsetMin = sign * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
    ms -= offsetMin * 60_000; // wall time at offset → UTC instant
  }
  return ms;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // ampersand last so it doesn't double-decode
}

// Targeted parse of machine-generated XMLTV: each <programme> block's start/stop/
// channel attributes plus its first <title> text. Dependency-free on purpose
// (keeps the webOS bundle lean; the input is regular).
export function parseXmltv(xml: string): Programme[] {
  const out: Programme[] = [];
  const block = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  let m: RegExpExecArray | null;
  while ((m = block.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const channel = attrs.match(/\bchannel="([^"]*)"/)?.[1];
    const start = parseXmltvDate(attrs.match(/\bstart="([^"]*)"/)?.[1] ?? "");
    const stop = parseXmltvDate(attrs.match(/\bstop="([^"]*)"/)?.[1] ?? "");
    const title = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1];
    if (!channel || Number.isNaN(start) || Number.isNaN(stop) || !title) continue;
    out.push({ channel, start, stop, title: decodeEntities(title).trim() });
  }
  return out;
}

// Group by channel id, each list sorted ascending by start time.
export function buildGuide(xml: string): Map<string, Programme[]> {
  const guide = new Map<string, Programme[]>();
  for (const p of parseXmltv(xml)) {
    const list = guide.get(p.channel) ?? [];
    list.push(p);
    guide.set(p.channel, list);
  }
  for (const list of guide.values()) list.sort((a, b) => a.start - b.start);
  return guide;
}

// `programmes` must be sorted by start (buildGuide guarantees it).
export function nowNext(programmes: Programme[], at: number = Date.now()): NowNext {
  const now = programmes.find((p) => p.start <= at && at < p.stop);
  const next = programmes.find((p) => p.start > at);
  return { now, next };
}
