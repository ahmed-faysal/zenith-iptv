// Build-time: join channels.json + logos.json + streams.json onto the M3U ids
// and write the slim src/data/enrichment.json the app merges at runtime.
//   npx tsx scripts/gen-channels.ts
// On any fetch failure, writes {} so a flaky build degrades to bare M3U.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseM3U } from "../src/lib/m3u";
import { buildEnrichment, type RawChannel, type RawLogo, type RawStream } from "../src/lib/enrich";

const M3U = "https://iptv-org.github.io/iptv/index.m3u";
const CH = "https://iptv-org.github.io/api/channels.json";
const LOGOS = "https://iptv-org.github.io/api/logos.json";
const STREAMS = "https://iptv-org.github.io/api/streams.json";
const OUT = "src/data/enrichment.json";

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  try {
    const [m3u, channels, logos, streams] = await Promise.all([
      fetch(M3U).then((r) => r.text()),
      fetch(CH).then((r) => r.json()) as Promise<RawChannel[]>,
      fetch(LOGOS).then((r) => r.json()) as Promise<RawLogo[]>,
      fetch(STREAMS).then((r) => r.json()) as Promise<RawStream[]>,
    ]);
    const ids = parseM3U(m3u).map((c) => c.id);
    const map = buildEnrichment(ids, channels, logos, streams);
    writeFileSync(OUT, JSON.stringify(map));
    console.log(`[gen] ids=${ids.length} enriched=${Object.keys(map).length} -> ${OUT}`);
  } catch (e) {
    writeFileSync(OUT, "{}");
    console.error("[gen] failed, wrote empty map:", (e as Error).message);
    process.exitCode = 1;
  }
}

main();
