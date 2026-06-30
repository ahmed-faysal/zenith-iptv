// Local stream validator — run on the home network so geo/IP/CORS match the TV:
//   npm run validate
// 1) build candidates from the source shortlist (reuses the app's merge),
// 2) fast HTTP probe to drop dead/unreachable URLs,
// 3) headless hls.js play-test (file:// origin, app's hlsConfig) to keep only
//    channels that actually play, working URL first,
// 4) write src/data/curated.json.
import { writeFileSync, mkdirSync, copyFileSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import puppeteer from "puppeteer";
import { getChannels } from "../src/lib/source";
import { hlsConfig } from "../src/lib/player";
import { probeChannelUrls, isManifestUrl, type UrlProbe } from "../src/lib/validate/probe";
import { reorderWorkingFirst, buildCuratedFile, type ValidationSummary } from "../src/lib/validate/curated";
import type { Channel } from "../src/lib/types";

const require = createRequire(import.meta.url);

const OUT = "src/data/curated.json";
const PROBE_TIMEOUT_MS = 8000;
const PLAY_TIMEOUT_MS = 12000;
const CONCURRENCY = 8;

// Fast probe via Node's global fetch, following redirects. Only manifests need
// their body read (to check the #EXTM3U marker).
const urlProbe: UrlProbe = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const bodyStart = isManifestUrl(url) ? (await res.text()).slice(0, 256) : "";
    return { status: res.status, bodyStart };
  } finally {
    clearTimeout(t);
  }
};

// Run fn over items with a fixed worker count.
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

// Like pool, but each worker owns a dedicated resource (a puppeteer page).
async function poolWithResource<T, R>(
  items: T[],
  resources: R[],
  fn: (item: T, res: R) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    resources.map(async (res) => {
      while (queue.length) await fn(queue.shift()!, res);
    }),
  );
}

async function main() {
  console.log("Building candidates from source shortlist…");
  const candidates = await getChannels();
  console.log(`Candidates: ${candidates.length}`);

  // Stage 1 — fast probe.
  console.log("Fast-probing URLs…");
  const probed: { channel: Channel; okUrls: string[] }[] = [];
  let pdone = 0;
  await pool(candidates, CONCURRENCY, async (channel) => {
    const okUrls = await probeChannelUrls(channel.streamUrls, urlProbe);
    if (okUrls.length > 0) probed.push({ channel, okUrls });
    if (++pdone % 100 === 0) console.log(`  probed ${pdone}/${candidates.length}`);
  });
  console.log(`Fast-probe survivors: ${probed.length}`);

  // Stage 2 — headless play-test. Vendor hls.min.js + harness into a temp dir
  // and load over file:// so the origin is opaque, exactly like the packaged app.
  const work = mkdtempSync(join(tmpdir(), "zenith-validate-"));
  copyFileSync(require.resolve("hls.js/dist/hls.min.js"), join(work, "hls.min.js"));
  copyFileSync("scripts/validate/harness.html", join(work, "harness.html"));
  const harnessUrl = "file://" + join(work, "harness.html");
  const cfg = JSON.stringify(hlsConfig());

  console.log("Launching headless Chromium…");
  const browser = await puppeteer.launch({
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
  });
  const pages = await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      const p = await browser.newPage();
      await p.goto(harnessUrl);
      return p;
    }),
  );

  const playable: Channel[] = [];
  let tdone = 0;
  await poolWithResource(probed, pages, async ({ channel, okUrls }, page) => {
    for (const url of okUrls) {
      const ok = await page
        .evaluate(
          (u, c, t) =>
            (window as unknown as { testStream: (u: string, c: object, t: number) => Promise<boolean> })
              .testStream(u, JSON.parse(c), t),
          url, cfg, PLAY_TIMEOUT_MS,
        )
        .catch(() => false);
      if (ok) {
        playable.push(reorderWorkingFirst(channel, url));
        break;
      }
    }
    if (++tdone % 50 === 0)
      console.log(`  play-tested ${tdone}/${probed.length} (playable: ${playable.length})`);
  });

  await browser.close();

  const summary: ValidationSummary = {
    candidates: candidates.length,
    fastProbePassed: probed.length,
    playable: playable.length,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(buildCuratedFile(playable, summary, new Date()), null, 2));
  console.log("\n✓ Wrote", OUT);
  console.log("Summary:", summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
