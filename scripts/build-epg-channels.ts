// CI step: produce the iptv-org/epg grabber's --channels input, scoped to only
// the channels the app actually serves (curated.json — same list /api/channels
// returns, live-merge fallback if it's ever empty) that also have a guide
// mapping. Run with:
//   npx tsx scripts/build-epg-channels.ts [outPath]
// Env: EPG_COUNTRIES="GB,US" optionally narrows the channel set (best coverage
// is per-country; smaller set => smaller, healthier guide). Default: all.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getChannels } from "../src/lib/source";
import { resolveCatalogue } from "../src/lib/catalogue";
import { toChannelsXml, scopeChannelIds, type GuideEntry } from "../src/lib/epg-channels";
import type { Channel } from "../src/lib/types";
import curatedFile from "../src/data/curated.json";

const GUIDES_URL = "https://iptv-org.github.io/api/guides.json";
const outPath = process.argv[2] ?? "epg-build/custom.channels.xml";

async function main() {
  const countries = (process.env.EPG_COUNTRIES ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  // Same source /api/channels uses: the validated curated list, or the raw
  // live merge if curated.json hasn't been populated yet.
  const seed = (curatedFile as { channels: Channel[] }).channels ?? [];
  const channels = await resolveCatalogue(seed, getChannels);
  const ids = scopeChannelIds(channels, countries);

  const guides: GuideEntry[] = await fetch(GUIDES_URL).then((r) => r.json());
  const xml = toChannelsXml(guides, ids);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, xml);

  const matched = (xml.match(/<channel /g) ?? []).length;
  console.log(
    `[epg] channels=${channels.length} (curated=${seed.length > 0}) scoped=${ids.size} ` +
    `guides=${guides.length} matched=${matched} -> ${outPath}`,
  );
  if (matched === 0) console.warn("[epg] WARNING: no channels matched a guide mapping.");
}

main().catch((e) => { console.error(e); process.exit(1); });
