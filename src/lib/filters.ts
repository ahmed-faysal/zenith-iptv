import type { Channel } from "./types";

// The `limit` most common values (by channel count) for a facet, most-common
// first. Keeps the settings pick-lists short enough to navigate with a remote.
export function topValues(
  channels: Channel[],
  pick: (c: Channel) => string[],
  limit: number
): string[] {
  const counts = new Map<string, number>();
  for (const c of channels) {
    for (const v of pick(c)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([v]) => v);
}
