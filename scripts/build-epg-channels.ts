// CI step: produce the iptv-org/epg grabber's --channels input, scoped to only
// the channels we surface that have a guide mapping. Run with:
//   npx tsx scripts/build-epg-channels.ts [outPath]
// Env: EPG_COUNTRIES="GB,US" optionally narrows the channel set (best coverage
// is per-country; smaller set => smaller, healthier guide). Default: all.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getChannels } from "../src/lib/source";
import { toChannelsXml, type GuideEntry } from "../src/lib/epg-channels";
import { baseChannelId } from "../src/lib/epg";

const GUIDES_URL = "https://iptv-org.github.io/api/guides.json";
const outPath = process.argv[2] ?? "epg-build/custom.channels.xml";

async function main() {
  const countries = (process.env.EPG_COUNTRIES ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  const channels = await getChannels();
  const scoped = countries.length
    ? channels.filter((c) => c.countries.some((x) => countries.includes(x.toUpperCase())))
    : channels;
  // Match guides on the base xmltv_id (strip the @feed suffix our ids carry).
  const ids = new Set(scoped.map((c) => baseChannelId(c.id)));

  const guides: GuideEntry[] = await fetch(GUIDES_URL).then((r) => r.json());
  const xml = toChannelsXml(guides, ids);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, xml);

  const matched = (xml.match(/<channel /g) ?? []).length;
  console.log(
    `[epg] channels=${channels.length} scoped=${scoped.length} ` +
    `guides=${guides.length} matched=${matched} -> ${outPath}`,
  );
  if (matched === 0) console.warn("[epg] WARNING: no channels matched a guide mapping.");
}

main().catch((e) => { console.error(e); process.exit(1); });
