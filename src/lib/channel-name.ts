// iptv-org bakes quality and status into the channel name itself, e.g.
// "3Cat Exclusiu 1 (1080p) [Geo-blocked]". This splits that raw string into a
// clean title plus chips for display — purely presentational, so the Channel's
// identity (id, favorites, search) keeps using the original name.

export type ParsedName = {
  title: string;
  quality: string | null; // e.g. "1080p", "576i"
  flags: string[]; // e.g. ["Geo-blocked", "Not 24/7"]
};

const QUALITY = /\((\d{3,4}[pi])\)/i; // a trailing-style (1080p)/(576i) parenthetical
const FLAG = /\[([^\]]+)\]/g; // any [bracketed] status note

export function parseChannelName(name: string): ParsedName {
  const flags: string[] = [];
  for (const m of name.matchAll(FLAG)) flags.push(m[1].trim());

  const q = name.match(QUALITY);
  const quality = q ? q[1].toLowerCase() : null;

  const title = name
    .replace(FLAG, "")
    .replace(QUALITY, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title, quality, flags };
}

// 720p and up reads as "HD"; useful for a compact badge.
export function isHd(quality: string | null): boolean {
  if (!quality) return false;
  const lines = parseInt(quality, 10);
  return Number.isFinite(lines) && lines >= 720;
}
