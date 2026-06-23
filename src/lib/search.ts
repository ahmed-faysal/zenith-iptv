import type { Channel } from "./types";
import type { EpgMap } from "@/hooks/useEpg";
import { baseChannelId } from "@/lib/epg";

// Live name search over the catalogue: case-insensitive substring match, capped
// so a broad query (e.g. "news") stays navigable with a remote. A blank query
// returns nothing so the view can show its browse/recents state instead.
export function searchChannels(channels: Channel[], query: string, limit = 60): Channel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return channels
    .filter((c) => c.name.toLowerCase().includes(needle))
    .slice(0, limit);
}

export type EpgResult = { channel: Channel; subtitle: string };

export function searchProgrammes(
  epgMap: EpgMap,
  channels: Channel[],
  query: string,
  exclude: Set<string>,
  limit = 30,
): EpgResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const out: EpgResult[] = [];
  for (const c of channels) {
    if (out.length >= limit) break;
    if (exclude.has(c.id)) continue;
    const baseId = baseChannelId(c.id);
    const entry = epgMap[baseId] ?? epgMap[baseId.split(".")[0]];
    if (!entry) continue;
    if (entry.now?.title.toLowerCase().includes(needle)) {
      out.push({ channel: c, subtitle: `Now · ${entry.now.title}` });
    } else if (entry.next?.title.toLowerCase().includes(needle)) {
      out.push({ channel: c, subtitle: `Next · ${entry.next.title}` });
    }
  }
  return out;
}
