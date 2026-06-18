import type { Channel } from "./types";

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
