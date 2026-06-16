import type { EpgEntry, EpgProgramme } from "./types";

// "20260616080000 +0000" -> Date
function parseXmltvTime(raw: string): Date {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi, s, tz = "+0000"] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz.slice(0, 3)}:${tz.slice(3)}`;
  return new Date(iso);
}

type Raw = { title: string; start: Date; stop: Date };

function programmesFor(xml: string, channelId: string): Raw[] {
  const out: Raw[] = [];
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const ch = attrs.match(/channel="([^"]*)"/)?.[1];
    if (ch !== channelId) continue;
    const start = attrs.match(/start="([^"]*)"/)?.[1] ?? "";
    const stop = attrs.match(/stop="([^"]*)"/)?.[1] ?? "";
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    out.push({ title, start: parseXmltvTime(start), stop: parseXmltvTime(stop) });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function parseEpgForChannel(xml: string, channelId: string, now: Date): EpgEntry {
  const items = programmesFor(xml, channelId);
  const entry: EpgEntry = {};
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (p.start <= now && now < p.stop) {
      const prog: EpgProgramme = {
        title: p.title,
        start: p.start.toISOString(),
        end: p.stop.toISOString(),
      };
      entry.now = prog;
      if (items[i + 1]) {
        entry.next = { title: items[i + 1].title, start: items[i + 1].start.toISOString() };
      }
      break;
    }
  }
  return entry;
}
