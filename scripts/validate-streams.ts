// Local stream validator — run on the home network so geo/IP/CORS match the TV:
//   npm run validate                 # full pass, resumes an interrupted run
//   npm run validate -- --limit 50   # short smoke run
//   npm run validate -- --fresh      # ignore the checkpoint, re-test everything
//
// Each channel is taken through both stages as one unit of work — a fast HTTP
// probe, then a headless hls.js play-test over a file:// origin (opaque, exactly
// like the packaged app) — and its outcome is checkpointed. A full pass takes
// ~100 minutes, so results are flushed to disk periodically: Ctrl-C, a crash or
// a closed laptop costs at most the last few channels, and the next run picks
// up where this one stopped.
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { getChannels } from "../src/lib/source";
import { hlsConfig } from "../src/lib/player";
import { probeChannelUrls, isManifestUrl, type UrlProbe } from "../src/lib/validate/probe";
import { buildCuratedFile } from "../src/lib/validate/curated";
import { parseValidateArgs } from "../src/lib/validate/args";
import {
  emptyCheckpoint, recordAttempt, pendingCandidates, playableChannels,
  checkpointSummary, validationFunnel, type Checkpoint,
} from "../src/lib/validate/checkpoint";
import type { Channel } from "../src/lib/types";

const require = createRequire(import.meta.url);

const OUT = "src/data/curated.json";
const CHECKPOINT = ".validate-checkpoint.json";
const PROBE_TIMEOUT_MS = 8000;
const PLAY_TIMEOUT_MS = 12000;
const CONCURRENCY = 8;
const FLUSH_EVERY = 25;

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

function loadCheckpoint(fresh: boolean): Checkpoint {
  if (fresh || !existsSync(CHECKPOINT)) return emptyCheckpoint(new Date());
  try {
    return JSON.parse(readFileSync(CHECKPOINT, "utf8")) as Checkpoint;
  } catch {
    console.warn(`[checkpoint] ${CHECKPOINT} unreadable — starting fresh`);
    return emptyCheckpoint(new Date());
  }
}

// Run fn over items with a fixed worker count, each worker owning a page.
async function poolWithResource<T, R>(
  items: T[],
  resources: R[],
  fn: (item: T, res: R) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    resources.map(async (res) => {
      // Safe: queue.length check and shift() are atomic in single-threaded JS.
      while (queue.length) await fn(queue.shift()!, res);
    }),
  );
}

async function main() {
  const { limit, fresh } = parseValidateArgs(process.argv.slice(2));

  console.log("Building candidates from source shortlist…");
  const candidates = await getChannels();
  const checkpoint = loadCheckpoint(fresh);
  const carried = checkpointSummary(checkpoint);
  const pending = pendingCandidates(candidates, checkpoint, limit);

  console.log(`Candidates:        ${candidates.length}`);
  if (carried.attempted > 0) {
    console.log(`Resuming:          ${carried.attempted} already tested (${carried.playable} playable)`);
  }
  console.log(`This run:          ${pending.length}${limit ? ` (--limit ${limit})` : ""}`);
  const leftover = candidates.length - carried.attempted - pending.length;
  if (leftover > 0) console.log(`Left after this:   ${leftover}`);
  if (pending.length === 0) {
    console.log("\nNothing to do. Use --fresh to re-test everything.");
    return;
  }

  // Vendor hls.min.js + harness into a temp dir and load over file:// so the
  // origin is opaque, exactly like the packaged app.
  const work = mkdtempSync(join(tmpdir(), "zenith-validate-"));
  copyFileSync(require.resolve("hls.js/dist/hls.min.js"), join(work, "hls.min.js"));
  copyFileSync("scripts/validate/harness.html", join(work, "harness.html"));
  const harnessUrl = "file://" + join(work, "harness.html");
  const cfg = JSON.stringify(hlsConfig());

  let done = 0;
  let sinceFlush = 0;
  const flush = () => {
    writeFileSync(CHECKPOINT, JSON.stringify(checkpoint));
    mkdirSync(dirname(OUT), { recursive: true });
    const file = buildCuratedFile(
      playableChannels(checkpoint, candidates),
      validationFunnel(checkpoint, candidates.length),
      new Date(),
    );
    writeFileSync(OUT, JSON.stringify(file, null, 2));
    sinceFlush = 0;
  };

  console.log("Launching headless Chromium…\n");
  const browser: Browser = await puppeteer.launch({
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    // Puppeteer's own signal handlers call process.exit() as soon as they fire.
    // They register during launch(), so they would run before ours and the
    // checkpoint would never be flushed on Ctrl-C. We take ownership instead
    // and kill the browser ourselves in onInterrupt.
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });

  // An interrupted run must not lose the work already done.
  const onInterrupt = () => {
    console.log("\n\nInterrupted — flushing checkpoint…");
    flush();
    console.log(`Progress saved. Re-run \`npm run validate\` to continue (${done} tested this run).`);
    browser.process()?.kill("SIGKILL");
    rmSync(work, { recursive: true, force: true });
    process.exit(130);
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);

  try {
    const pages: Page[] = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const p = await browser.newPage();
        await p.goto(harnessUrl);
        return p;
      }),
    );

    await poolWithResource(pending, pages, async (channel: Channel, page) => {
      // Stage 1 — fast probe. A channel with no reachable URL never reaches
      // the browser, and is recorded so a resume doesn't re-probe it.
      const okUrls = await probeChannelUrls(channel.streamUrls, urlProbe);
      if (okUrls.length === 0) {
        recordAttempt(checkpoint, channel.id, { ok: false, stage: "probe" });
      } else {
        // Stage 2 — headless play-test; first URL that genuinely plays wins.
        let playedUrl: string | null = null;
        for (const url of okUrls) {
          const ok = await page
            .evaluate(
              (u, c, t) =>
                (window as unknown as { testStream: (u: string, c: object, t: number) => Promise<boolean> })
                  .testStream(u, JSON.parse(c), t),
              url, cfg, PLAY_TIMEOUT_MS,
            )
            .catch(() => false);
          if (ok) { playedUrl = url; break; }
        }
        recordAttempt(
          checkpoint,
          channel.id,
          playedUrl ? { ok: true, url: playedUrl } : { ok: false, stage: "play" },
        );
      }

      done++;
      if (++sinceFlush >= FLUSH_EVERY) flush();
      if (done % 25 === 0) {
        const s = checkpointSummary(checkpoint);
        const pct = ((done / pending.length) * 100).toFixed(0);
        console.log(`  ${done}/${pending.length} (${pct}%) — playable so far: ${s.playable}`);
      }
    });
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }

  flush();
  const funnel = validationFunnel(checkpoint, candidates.length);
  console.log("\n✓ Wrote", OUT);
  console.log("Funnel:", funnel);
  const untested = candidates.length - checkpointSummary(checkpoint).attempted;
  if (untested > 0) console.log(`\n${untested} channels still untested — re-run to continue.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
