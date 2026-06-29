# Curated, Locally-Validated Channel Catalogue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ~13.5k iptv-org firehose with a curated catalogue built by a local validation script that play-tests every candidate stream the way the TV plays it, so the app only shows channels that actually work.

**Architecture:** Shortlist a few sources in `sources.ts`; a local script (`npm run validate`) reuses the app's merge pipeline to build candidates, fast-probes them over HTTP, then play-tests survivors in a headless Chromium running real hls.js over a `file://` origin (matching the packaged TV exactly for CORS/geo/codec), and writes `src/data/curated.json`. `/api/channels` serves that file curated-only.

**Tech Stack:** TypeScript, Next.js (App Router, route handlers), Vitest, tsx, Puppeteer (dev-only), hls.js 1.6.16.

## Global Constraints

- **Curated-only:** `/api/channels` serves `src/data/curated.json` with no live-merge fallback.
- **Response headers unchanged:** `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600` on `/api/channels`.
- **`Channel` shape unchanged:** `{ id, name, logo, streamUrls, category, languages, countries, quality? }` (see `src/lib/types.ts`).
- **Validator runs locally** (home network), never in CI/Vercel; Puppeteer + tsx are devDependencies only and never ship to the TV.
- **Reuse, don't reinvent:** candidates come from the existing `getChannels()` (`src/lib/source.ts`); the harness uses the app's `hlsConfig()` (`src/lib/player.ts`).
- **Headless origin must be `file://`** so CORS/mixed-content behave exactly like the packaged webOS app.
- **Imports in `scripts/` are relative** (e.g. `../src/lib/source`), matching `scripts/gen-channels.ts`. `tsx` resolves the `@/*` → `./src/*` alias transitively (verified).
- **Pure validator logic lives in `src/lib/validate/`** (unit-tested); the browser orchestrator lives in `scripts/` (integration, manually smoke-tested).

---

## File Structure

**Create:**
- `src/lib/validate/probe.ts` — pure fast-probe classification + per-channel URL probe.
- `src/lib/validate/curated.ts` — pure helpers: URL reordering + curated-file assembly.
- `scripts/validate/harness.html` — headless player page (hls.js + `window.testStream`).
- `scripts/validate-streams.ts` — orchestrator (candidates → probe → play-test → write).
- `src/data/curated.json` — output (seeded empty in Task 4, populated in Task 6).
- Tests: `__tests__/validate-probe.test.ts`, `__tests__/validate-curated.test.ts`, `__tests__/api-channels-curated.test.ts`.

**Modify:**
- `src/lib/sources.ts` — shortlist `SOURCES`.
- `src/app/api/channels/route.ts` — curated-only.
- `package.json` — `validate` script + `puppeteer`/`tsx` devDeps.
- `docs/BACKLOG.md` — record the curated workflow (Task 6).

---

### Task 1: Source shortlist

**Files:**
- Modify: `src/lib/sources.ts:13-18` (the `SOURCES` array)
- Test: `__tests__/sources-shortlist.test.ts`

**Interfaces:**
- Consumes: existing `Source` type and `SOURCES` export from `src/lib/sources.ts`.
- Produces: a `SOURCES` array with labels `abema, atsushi-jp, atsushi-tv, iptv-jp, iptv-news, iptv-sports, iptv-in, iptv-bd, free-tv` and no `index.m3u` entry.

- [ ] **Step 1: Write the failing test**

Create `__tests__/sources-shortlist.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SOURCES } from "@/lib/sources";

describe("source shortlist", () => {
  it("drops the full iptv-org index firehose", () => {
    expect(SOURCES.some((s) => s.url.endsWith("/iptv/index.m3u"))).toBe(false);
  });

  it("includes the curated shortlist labels", () => {
    const labels = SOURCES.map((s) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "abema", "atsushi-jp", "atsushi-tv", "iptv-jp",
        "iptv-news", "iptv-sports", "iptv-in", "iptv-bd", "free-tv",
      ]),
    );
  });

  it("tags News and Sports category sources so the 'Other' fallback is overridden", () => {
    expect(SOURCES.find((s) => s.label === "iptv-news")?.category).toBe("News");
    expect(SOURCES.find((s) => s.label === "iptv-sports")?.category).toBe("Sports");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run __tests__/sources-shortlist.test.ts`
Expected: FAIL — current `SOURCES` still contains `iptv-org` `index.m3u` and lacks the new labels.

- [ ] **Step 3: Replace the `SOURCES` array**

In `src/lib/sources.ts`, replace the existing `SOURCES` array (lines 13-18) with:
```ts
export const SOURCES: Source[] = [
  { label: "abema",       url: "https://raw.githubusercontent.com/karenda-jp/AbemaTV/main/abema240P.m3u", country: "JP", language: "Japanese" },
  { label: "atsushi-jp",  url: "https://raw.githubusercontent.com/atsushi444/iptv/master/jp.m3u", country: "JP", language: "Japanese" },
  { label: "atsushi-tv",  url: "https://raw.githubusercontent.com/atsushi444/iptv/master/tv.m3u" },
  { label: "iptv-jp",     url: "https://iptv-org.github.io/iptv/countries/jp.m3u", country: "JP" },
  { label: "iptv-news",   url: "https://iptv-org.github.io/iptv/categories/news.m3u", category: "News" },
  { label: "iptv-sports", url: "https://iptv-org.github.io/iptv/categories/sports.m3u", category: "Sports" },
  { label: "iptv-in",     url: "https://iptv-org.github.io/iptv/countries/in.m3u", country: "IN" },
  { label: "iptv-bd",     url: "https://iptv-org.github.io/iptv/countries/bd.m3u", country: "BD" },
  { label: "free-tv",     url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },
];
```
Leave the comment above it and `applyDefaults` below it unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run __tests__/sources-shortlist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources.ts __tests__/sources-shortlist.test.ts
git commit -m "Shortlist channel sources (drop iptv-org index firehose)"
```

---

### Task 2: Fast-probe module

**Files:**
- Create: `src/lib/validate/probe.ts`
- Test: `__tests__/validate-probe.test.ts`

**Interfaces:**
- Produces:
  - `type ProbeVerdict = "ok" | "dead" | "blocked"`
  - `classifyProbe(status: number, bodyStart: string, isManifest: boolean): ProbeVerdict`
  - `isManifestUrl(url: string): boolean`
  - `type UrlProbe = (url: string) => Promise<{ status: number; bodyStart: string }>`
  - `probeChannelUrls(urls: string[], probe: UrlProbe): Promise<string[]>` — returns the subset of `urls` that classify `"ok"`, in original order.

- [ ] **Step 1: Write the failing test**

Create `__tests__/validate-probe.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyProbe, isManifestUrl, probeChannelUrls, type UrlProbe } from "@/lib/validate/probe";

describe("classifyProbe", () => {
  it("marks a valid HLS manifest ok", () => {
    expect(classifyProbe(200, "#EXTM3U\n#EXT-X-VERSION:3", true)).toBe("ok");
  });
  it("marks a 200 that is NOT a manifest dead (soft-404 HTML page)", () => {
    expect(classifyProbe(200, "<!DOCTYPE html>", true)).toBe("dead");
  });
  it("accepts a reachable non-manifest URL without the marker", () => {
    expect(classifyProbe(200, "", false)).toBe("ok");
  });
  it("treats 401/403 as blocked", () => {
    expect(classifyProbe(403, "", true)).toBe("blocked");
    expect(classifyProbe(401, "", true)).toBe("blocked");
  });
  it("treats 404/410/5xx/0 as dead", () => {
    expect(classifyProbe(404, "", true)).toBe("dead");
    expect(classifyProbe(410, "", true)).toBe("dead");
    expect(classifyProbe(503, "", true)).toBe("dead");
    expect(classifyProbe(0, "", true)).toBe("dead");
  });
});

describe("isManifestUrl", () => {
  it("detects .m3u8 with and without query", () => {
    expect(isManifestUrl("https://x/playlist.m3u8")).toBe(true);
    expect(isManifestUrl("https://x/playlist.m3u8?token=1")).toBe(true);
    expect(isManifestUrl("https://x/stream.ts")).toBe(false);
  });
});

describe("probeChannelUrls", () => {
  it("returns only ok urls in original order", async () => {
    const probe: UrlProbe = async (url) => {
      if (url.includes("good")) return { status: 200, bodyStart: "#EXTM3U" };
      if (url.includes("blocked")) return { status: 403, bodyStart: "" };
      return { status: 404, bodyStart: "" };
    };
    const out = await probeChannelUrls(
      ["https://a/good1.m3u8", "https://a/dead.m3u8", "https://a/blocked.m3u8", "https://a/good2.m3u8"],
      probe,
    );
    expect(out).toEqual(["https://a/good1.m3u8", "https://a/good2.m3u8"]);
  });
  it("treats a thrown probe (network error) as dead and skips it", async () => {
    const probe: UrlProbe = async (url) => {
      if (url.includes("throw")) throw new Error("ECONNREFUSED");
      return { status: 200, bodyStart: "#EXTM3U" };
    };
    const out = await probeChannelUrls(["https://a/throw.m3u8", "https://a/ok.m3u8"], probe);
    expect(out).toEqual(["https://a/ok.m3u8"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run __tests__/validate-probe.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validate/probe'`.

- [ ] **Step 3: Write the module**

Create `src/lib/validate/probe.ts`:
```ts
// Pure stream-reachability classification for the local validator.
export type ProbeVerdict = "ok" | "dead" | "blocked";

// Decide a single URL's reachability from its HTTP status and the first bytes of
// the body. For HLS manifests (.m3u8) we additionally require the playlist marker
// so a soft-404 HTML page served with status 200 doesn't count as alive.
export function classifyProbe(status: number, bodyStart: string, isManifest: boolean): ProbeVerdict {
  if (status === 401 || status === 403) return "blocked";
  if (status < 200 || status >= 400) return "dead";
  if (isManifest) return bodyStart.includes("#EXTM3U") ? "ok" : "dead";
  return "ok";
}

export function isManifestUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export type UrlProbe = (url: string) => Promise<{ status: number; bodyStart: string }>;

// Return the subset of a channel's URLs that probe "ok", preserving order.
// A channel survives the fast stage when this is non-empty. A probe that throws
// (DNS failure, connection refused) is treated as dead and skipped.
export async function probeChannelUrls(urls: string[], probe: UrlProbe): Promise<string[]> {
  const ok: string[] = [];
  for (const url of urls) {
    try {
      const { status, bodyStart } = await probe(url);
      if (classifyProbe(status, bodyStart, isManifestUrl(url)) === "ok") ok.push(url);
    } catch {
      // network throw == dead, skip
    }
  }
  return ok;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run __tests__/validate-probe.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate/probe.ts __tests__/validate-probe.test.ts
git commit -m "Add fast-probe stream classification for the validator"
```

---

### Task 3: Curated-file shaping module

**Files:**
- Create: `src/lib/validate/curated.ts`
- Test: `__tests__/validate-curated.test.ts`

**Interfaces:**
- Consumes: `Channel` from `src/lib/types.ts`.
- Produces:
  - `type ValidationSummary = { candidates: number; fastProbePassed: number; playable: number }`
  - `type CuratedFile = { generatedAt: string; summary: ValidationSummary; channels: Channel[] }`
  - `reorderWorkingFirst(channel: Channel, workingUrl: string): Channel` — returns a copy with `workingUrl` first and the other URLs after, in order.
  - `buildCuratedFile(channels: Channel[], summary: ValidationSummary, now: Date): CuratedFile`

- [ ] **Step 1: Write the failing test**

Create `__tests__/validate-curated.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reorderWorkingFirst, buildCuratedFile } from "@/lib/validate/curated";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "CNN.us", name: "CNN", logo: "", category: "News",
  languages: ["English"], countries: ["US"],
  streamUrls: ["https://a/1.m3u8", "https://a/2.m3u8", "https://a/3.m3u8"],
};

describe("reorderWorkingFirst", () => {
  it("moves the working URL to the front, keeping the rest in order", () => {
    const out = reorderWorkingFirst(ch, "https://a/2.m3u8");
    expect(out.streamUrls).toEqual(["https://a/2.m3u8", "https://a/1.m3u8", "https://a/3.m3u8"]);
  });
  it("does not mutate the input channel", () => {
    reorderWorkingFirst(ch, "https://a/2.m3u8");
    expect(ch.streamUrls[0]).toBe("https://a/1.m3u8");
  });
  it("leaves other fields untouched", () => {
    const out = reorderWorkingFirst(ch, "https://a/3.m3u8");
    expect(out.id).toBe("CNN.us");
    expect(out.name).toBe("CNN");
    expect(out.category).toBe("News");
  });
});

describe("buildCuratedFile", () => {
  it("assembles generatedAt, summary, and channels", () => {
    const summary = { candidates: 100, fastProbePassed: 70, playable: 55 };
    const file = buildCuratedFile([ch], summary, new Date("2026-06-30T12:00:00Z"));
    expect(file.generatedAt).toBe("2026-06-30T12:00:00.000Z");
    expect(file.summary).toEqual(summary);
    expect(file.channels).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run __tests__/validate-curated.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validate/curated'`.

- [ ] **Step 3: Write the module**

Create `src/lib/validate/curated.ts`:
```ts
import type { Channel } from "../types";

export type ValidationSummary = {
  candidates: number;
  fastProbePassed: number;
  playable: number;
};

export type CuratedFile = {
  generatedAt: string;
  summary: ValidationSummary;
  channels: Channel[];
};

// Put the URL that actually played first; keep the others as ordered fallbacks.
export function reorderWorkingFirst(channel: Channel, workingUrl: string): Channel {
  const rest = channel.streamUrls.filter((u) => u !== workingUrl);
  return { ...channel, streamUrls: [workingUrl, ...rest] };
}

// Assemble the on-disk curated catalogue.
export function buildCuratedFile(
  channels: Channel[],
  summary: ValidationSummary,
  now: Date,
): CuratedFile {
  return { generatedAt: now.toISOString(), summary, channels };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run __tests__/validate-curated.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate/curated.ts __tests__/validate-curated.test.ts
git commit -m "Add curated-file shaping helpers for the validator"
```

---

### Task 4: Curated-only `/api/channels` + seed file

**Files:**
- Create: `src/data/curated.json` (seed, empty channel list)
- Modify: `src/app/api/channels/route.ts` (whole file)
- Test: `__tests__/api-channels-curated.test.ts`

**Interfaces:**
- Consumes: `CuratedFile` shape from Task 3 (`{ generatedAt, summary, channels }`), `Channel` from `src/lib/types.ts`.
- Produces: `GET()` returning `NextResponse.json({ channels }, { headers })` where `channels` is `curated.channels`.

- [ ] **Step 1: Create the seed curated.json**

Create `src/data/curated.json` so the static import compiles before the validator has run:
```json
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "summary": { "candidates": 0, "fastProbePassed": 0, "playable": 0 },
  "channels": []
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/api-channels-curated.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

// Serve a known curated payload regardless of the on-disk seed.
vi.mock("@/data/curated.json", () => ({
  default: {
    generatedAt: "2026-06-30T12:00:00.000Z",
    summary: { candidates: 1, fastProbePassed: 1, playable: 1 },
    channels: [
      { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["https://a/1.m3u8"],
        category: "News", languages: ["English"], countries: ["US"] },
    ],
  },
}));

import { GET } from "@/app/api/channels/route";

describe("/api/channels (curated-only)", () => {
  it("serves the curated channels", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].id).toBe("CNN.us");
  });
  it("keeps the CORS and cache headers", async () => {
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run __tests__/api-channels-curated.test.ts`
Expected: FAIL — the current route imports `getChannels` and calls it; `body.channels` will not match the mocked curated payload (the mock of `@/data/curated.json` is unused by the old route).

- [ ] **Step 4: Rewrite the route curated-only**

Replace the entire contents of `src/app/api/channels/route.ts` with:
```ts
import { NextResponse } from "next/server";
import type { Channel } from "@/lib/types";
import curated from "@/data/curated.json";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

// Curated-only: serve the locally-validated catalogue (src/data/curated.json).
// No live source merge at request time — the list is refreshed by running
// `npm run validate` locally and committing the result. See
// docs/superpowers/specs/2026-06-30-curated-catalogue-design.md.
export function GET() {
  const channels = (curated as { channels: Channel[] }).channels ?? [];
  return NextResponse.json({ channels }, { headers: HEADERS });
}
```

- [ ] **Step 5: Run the new test and the existing CORS test**

Run: `npm test -- --run __tests__/api-channels-curated.test.ts __tests__/api-cors.test.ts`
Expected: PASS. (`api-cors.test.ts` still passes: the channels route returns the CORS header from the seed import; its `@/lib/source` mock is now unused by the channels route but harmless.)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `npm test -- --run`
Expected: PASS (all files). The old behaviour test that asserted `/api/channels` calls `getChannels` (if any beyond `api-cors`) should be reconciled — if a test references `getChannels` being invoked by this route, delete that assertion since the route no longer merges live. (`api-cors.test.ts` only checks headers, so it is unaffected.)

- [ ] **Step 7: Commit**

```bash
git add src/data/curated.json src/app/api/channels/route.ts __tests__/api-channels-curated.test.ts
git commit -m "Serve /api/channels curated-only from curated.json"
```

---

### Task 5: Headless validator orchestrator

**Files:**
- Create: `scripts/validate/harness.html`
- Create: `scripts/validate-streams.ts`
- Modify: `package.json` (add `validate` script + `puppeteer` and `tsx` devDependencies)

**Interfaces:**
- Consumes: `getChannels` (`../src/lib/source`), `hlsConfig` (`../src/lib/player`), `probeChannelUrls`/`isManifestUrl` (`../src/lib/validate/probe`), `reorderWorkingFirst`/`buildCuratedFile`/`ValidationSummary` (`../src/lib/validate/curated`), `Channel` (`../src/lib/types`).
- Produces: writes `src/data/curated.json`; the `npm run validate` command.

This task is integration glue (drives a real browser), so it is **not** unit-tested. Verify it with the manual smoke run in Step 6. Provide the code exactly.

- [ ] **Step 1: Add Puppeteer and tsx as devDependencies**

Run:
```bash
npm install -D puppeteer tsx
```
Expected: `package.json` gains `puppeteer` and `tsx` under `devDependencies`, and Puppeteer downloads a Chromium build (one-time).

- [ ] **Step 2: Add the `validate` script to package.json**

In `package.json`, add to the `"scripts"` block (alongside `"gen:channels"`):
```json
    "validate": "tsx scripts/validate-streams.ts"
```

- [ ] **Step 3: Create the headless player harness**

Create `scripts/validate/harness.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Zenith stream validator</title></head>
  <body>
    <script src="./hls.min.js"></script>
    <script>
      // Resolve true when a fragment actually buffers (real playback), false on
      // any fatal error or timeout. Mirrors VideoPlayer's hls.js/native split so
      // "plays here" implies "plays on the TV". Loaded over file:// so CORS and
      // mixed-content match the packaged webOS app.
      window.testStream = function (url, config, timeoutMs) {
        return new Promise(function (resolve) {
          var video = document.createElement("video");
          video.muted = true;
          var hls = null;
          var done = false;
          function finish(ok) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try { if (hls) hls.destroy(); } catch (e) {}
            resolve(ok);
          }
          var timer = setTimeout(function () { finish(false); }, timeoutMs);
          if (window.Hls && window.Hls.isSupported()) {
            hls = new Hls(config);
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.FRAG_BUFFERED, function () { finish(true); });
            hls.on(Hls.Events.ERROR, function (_e, data) { if (data.fatal) finish(false); });
            video.play().catch(function () {});
          } else {
            video.src = url;
            video.addEventListener("loadeddata", function () { finish(true); });
            video.addEventListener("error", function () { finish(false); });
            video.play().catch(function () {});
          }
        });
      };
    </script>
  </body>
</html>
```

- [ ] **Step 4: Create the orchestrator**

Create `scripts/validate-streams.ts`:
```ts
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
```

- [ ] **Step 5: Type-check the script compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors from `scripts/validate-streams.ts` (the `@/*` alias and relative imports resolve; `puppeteer` types are present). If `scripts/` is excluded from `tsconfig.json`, instead run `npx tsx --check scripts/validate-streams.ts` is not available — use `node --experimental-strip-types` is not needed; verify by a dry import: `npx tsx -e "import('./scripts/validate-streams.ts')"` will start `main()`, so skip and rely on Step 6.

- [ ] **Step 6: Manual smoke run (small slice)**

Temporarily cap candidates for a quick smoke: at the top of `main()`, after `const candidates = await getChannels();`, add `const slice = candidates.slice(0, 40);` and use `slice` in place of `candidates` for both stages and the `candidates:` summary count. Then:

Run: `npm run validate`
Expected: prints "Candidates: 40", a fast-probe survivor count, "Launching headless Chromium…", play-test progress, then "✓ Wrote src/data/curated.json" and a `Summary:` line with non-zero `playable`. Open `src/data/curated.json` and confirm it has a `channels` array with reordered `streamUrls`.

**Remove the temporary `slice` lines after the smoke run** so the full validation runs in Task 6.

- [ ] **Step 7: Commit (script only, not the smoke-run curated.json)**

```bash
git add package.json package-lock.json scripts/validate/harness.html scripts/validate-streams.ts
git checkout -- src/data/curated.json   # discard the 40-channel smoke output; Task 6 generates the real one
git commit -m "Add local headless stream validator (npm run validate)"
```

---

### Task 6: Generate the real catalogue + document the workflow

**Files:**
- Modify: `src/data/curated.json` (populated by the full validation run)
- Modify: `docs/BACKLOG.md` (record the curated workflow)

**Interfaces:**
- Consumes: the `npm run validate` command from Task 5.
- Produces: a populated `src/data/curated.json` consumed by `/api/channels` (Task 4).

- [ ] **Step 1: Run the full validation**

Run: `npm run validate`
Expected: runs over the full shortlist (~3,000–3,500 candidates), ~20–40 min. Ends with `✓ Wrote src/data/curated.json` and a `Summary:` line. Confirm `summary.playable` is a healthy count (expect roughly 1,000–2,500).

- [ ] **Step 2: Sanity-check the output**

Run:
```bash
node -e 'const c=require("./src/data/curated.json"); console.log(c.summary); console.log("channels:", c.channels.length); console.log("sample:", c.channels.slice(0,3).map(x=>x.name));'
```
Expected: `channels.length === summary.playable`, names look like real channels, and no entry has an empty `streamUrls`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS (all files), confirming the populated curated.json still satisfies the route and shaping tests.

- [ ] **Step 4: Document the refresh workflow in BACKLOG**

In `docs/BACKLOG.md`, under the current-state section, add a bullet:
```markdown
- **Curated catalogue** — `/api/channels` serves `src/data/curated.json`, a
  locally-validated list (no live merge). Refresh by running `npm run validate`
  on the home network (fast HTTP probe + headless hls.js play-test over a
  file:// origin so geo/IP/CORS match the TV), then commit `src/data/curated.json`
  and push; Vercel redeploys and the TV picks it up on next launch. Spec:
  docs/superpowers/specs/2026-06-30-curated-catalogue-design.md.
```

- [ ] **Step 5: Commit**

```bash
git add src/data/curated.json docs/BACKLOG.md
git commit -m "Generate validated curated catalogue + document refresh workflow"
```

---

## Self-Review

**Spec coverage:**
- Source shortlist (incl. AbemaTV, IN/BD) → Task 1. ✓
- Candidate builder reuse (`getChannels`) → Task 5 Step 4. ✓
- Fast-probe module → Task 2. ✓
- Headless play-test, `file://` origin, app `hlsConfig()` → Task 5 (harness + orchestrator). ✓
- `curated.json` shape (`generatedAt`/`summary`/`channels`) → Task 3 + Task 4 seed. ✓
- Curated-only `/api/channels` with CORS+cache headers → Task 4. ✓
- `package.json` `validate` script + Puppeteer/tsx devDeps → Task 5. ✓
- Tests (probe, curated, route) → Tasks 2, 3, 4. ✓
- First-deploy needs curated.json (seed + real generation) → Task 4 Step 1 + Task 6. ✓
- Refresh-workflow docs → Task 6 Step 4. ✓
- Out-of-scope items (AbemaTV EPG, Pluto native-HLS, scheduling) → intentionally not tasked. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `ProbeVerdict`, `UrlProbe`, `probeChannelUrls`, `classifyProbe`, `isManifestUrl` (Task 2) used identically in Task 5. `ValidationSummary`, `CuratedFile`, `reorderWorkingFirst`, `buildCuratedFile` (Task 3) used identically in Tasks 4 (shape) and 5. `Channel` shape matches `src/lib/types.ts` throughout. The route's `{ channels }` payload matches the existing client (`channels-client.ts` reads `d.channels`). ✓
