export type RawLogo = {
  channel: string; feed: string | null; in_use: boolean; tags: string[];
  width: number; height: number; format: string; url: string;
};

const FORMAT_RANK: Record<string, number> = { SVG: 3, WEBP: 2, PNG: 1 };

// Best logo URL for a channel: in-use first, then format (SVG scales for TV),
// then larger area. When `feed` is given, a feed-specific logo outranks the
// channel-level one.
export function bestLogo(logos: RawLogo[], feed?: string | null): string | undefined {
  if (logos.length === 0) return undefined;
  const score = (l: RawLogo): number =>
    (l.in_use ? 1_000_000 : 0) +
    (feed && l.feed === feed ? 500_000 : 0) +
    (FORMAT_RANK[l.format?.toUpperCase()] ?? 0) * 100_000 +
    Math.min(l.width * l.height, 99_999);
  return [...logos].sort((a, b) => score(b) - score(a))[0].url;
}
