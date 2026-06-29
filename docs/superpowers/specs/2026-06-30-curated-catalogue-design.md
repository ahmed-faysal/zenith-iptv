# Curated, Locally-Validated Channel Catalogue — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorming), ready for implementation plan

## Problem

The app ingests iptv-org's full `index.m3u` (~13.5k channels, 18k stream URLs).
Measured catalogue health (random 200-stream probe + full-catalogue analysis):

- **~22%** of streams are hard-dead (DNS fail / 404 / timeout) — IP-independent,
  so the TV sees this rot too.
- **1,432 channels (10.6%)** are 100% Pluto (`jmp2.uk`) — they return HTTP 200 to
  a server probe but **fail in the TV's hls.js via CORS**.
- **80%** of channels are single-URL (no failover safety net).

Net effect on the LG webOS TV: most channels are unplayable. Swapping in "better
sources" alone does not fix this — every free IPTV list rots at a similar rate.
The durable fix is to **stop showing streams that don't actually play from where
the TV lives.**

## Key insight

The user is in **Japan**, and the TV runs on the home network. Validating streams
**from that same machine/IP/geolocation** reproduces the TV's exact network
context: geo-blocks, IP-blocks, and (via a headless browser) CORS and codec
behaviour. A validator run locally therefore produces a catalogue with high
"surety" of actually playing on the TV — something a datacenter CI job cannot do.

## Goal

Replace the firehose with a **curated catalogue** built by a **local validation
script**: shortlist a few known sources, test every candidate stream the way the
TV plays it, and ship only the survivors. The player consumes this curated list.

## Architecture

```
 sources.ts (shortlist)
        │
        ▼  reuse existing merge+enrich pipeline (getChannels)
 candidate channels (~3,500)
        │
        ▼   scripts/validate-streams.ts   ── run locally: `npm run validate`
   ┌───────────────────────────────────────────────┐
   │ 1. fast probe (HTTP + manifest)  → drop dead   │
   │ 2. headless hls.js play-test     → keep playable│
   │    (same hlsConfig() as the app, file:// origin)│
   └───────────────────────────────────────────────┘
        │
        ▼
 src/data/curated.json  ──commit & push──▶ Vercel /api/channels ──▶ TV app + website
```

The app code is essentially unchanged — it still fetches `/api/channels`.
Refreshing the catalogue is **run validator → git push → Vercel redeploys → TV
picks it up on next launch** (no `.ipk` reinstall).

## Components

### 1. Source shortlist — `src/lib/sources.ts`
Replace the `index.m3u` entry with a focused, mostly Japan-reachable set:

| label | url | country / category defaults |
|---|---|---|
| `abema` | `https://raw.githubusercontent.com/karenda-jp/AbemaTV/main/abema240P.m3u` | country JP, language Japanese |
| `atsushi-jp` | (existing) | JP / Japanese |
| `atsushi-tv` | (existing) | — |
| `iptv-jp` | `https://iptv-org.github.io/iptv/countries/jp.m3u` | JP |
| `iptv-news` | `https://iptv-org.github.io/iptv/categories/news.m3u` | category News |
| `iptv-sports` | `https://iptv-org.github.io/iptv/categories/sports.m3u` | category Sports |
| `iptv-in` | `https://iptv-org.github.io/iptv/countries/in.m3u` | IN |
| `iptv-bd` | `https://iptv-org.github.io/iptv/countries/bd.m3u` | BD |
| `free-tv` | (existing) | — |

The full `index.m3u` source is removed. All other merge/enrichment behaviour is
unchanged. (AbemaTV streams are Japan-geo-locked and HLS-on-Akamai, not
CORS-locked; they also ship an EPG — out of scope here, noted for later.)

**Known limitation (documented, not a bug):** the TV sits on a Japanese IP, so
India/Bangladesh channels that are geo-locked to those countries cannot play on
the TV regardless of source. The validator keeps only their globally-available
subset (mostly news / FAST). This is correct behaviour.

### 2. Candidate builder
Reuse the existing `getChannels()` in `src/lib/source.ts` (fetch shortlist →
parse → merge → enrich). With the shrunken `SOURCES`, it returns the candidate
pool directly. No new merge code.

### 3. Fast-probe module — `src/lib/validate/probe.ts` (pure, unit-tested)
- `classifyProbe(status: number, bodyStart: string): "ok" | "dead" | "blocked"`
  - `200/206/30x` **and** body starts with `#EXTM3U` (for `.m3u8`) → `ok`
  - `000/404/410` → `dead`
  - `401/403` → `blocked` (from the home IP this is genuinely blocked → drop)
  - other → `dead`
- `probeChannel(channel, fetchFn, timeoutMs)` → resolves the subset of the
  channel's `streamUrls` that classify `ok`. A channel **survives** fast-probe if
  ≥1 URL is `ok`. Survivors carry only their `ok` URLs forward.

### 4. Headless play-test — `scripts/validate-streams.ts` + `scripts/validate/harness.html`
- `harness.html`: a minimal page bundling `hls.js` + the app's `hlsConfig()`,
  exposing `window.testStream(url): Promise<boolean>` — resolves `true` when a
  fragment buffers / `playing` fires within ~12s, `false` on fatal error/timeout.
- The script launches **Puppeteer** (Chromium), loads `harness.html` over a
  **`file://`** URL so the origin is opaque ("null") **exactly like the packaged
  TV app** — this makes CORS and mixed-content (http streams) behave identically
  to the TV. Pluto/`jmp2.uk` therefore correctly fail and are excluded; working
  `http` streams correctly pass.
- For each fast-probe survivor, try its `ok` URLs in order; first that plays makes
  the channel **pass**, and that URL is moved to the front of `streamUrls`.
- Concurrency: a pool of N pages (default 8). Prints a running progress line.

### 5. Output — `src/data/curated.json`
```jsonc
{
  "generatedAt": "2026-06-30T12:00:00Z",
  "summary": { "candidates": 3500, "fastProbePassed": 2200, "playable": 1800 },
  "channels": [ /* validated Channel[], working URL first */ ]
}
```
`Channel` shape is unchanged (`id, name, logo, streamUrls, category, languages,
countries, quality`).

### 6. Runtime — `src/app/api/channels/route.ts`
- **Curated-only.** Statically import `curated.json`; serve `curated.channels`
  with the existing `Access-Control-Allow-Origin: *` and `Cache-Control:
  public, max-age=3600` headers.
- No live source merge at request time (faster, no server-side IP-block issues).
- If `curated.json` is empty, return `{ channels: [] }` — the UI already shows a
  "Loading / no channels" state; we simply never ship an empty file.
- `getChannels()` stays exported (now used only by the validator).

### 7. `package.json`
- Add script: `"validate": "tsx scripts/validate-streams.ts"`.
- Add devDependencies: `puppeteer`, `tsx` (currently run via npx; pin it).
- These are dev-only; nothing new ships to the TV.

## Data flow / refresh cycle
1. `npm run validate` (locally, on the JP home network).
2. Review the printed summary; `git add src/data/curated.json && git commit && git push`.
3. Vercel redeploys; the TV gets the fresh catalogue on next app launch.

## Testing
- **`probe.test.ts`** — `classifyProbe` truth table (ok/dead/blocked) and
  `probeChannel` survivor logic with a stub `fetchFn`.
- **`curated-shape.test.ts`** — the helper that turns a passed candidate +
  working URL into a curated entry (URL reordering, field passthrough).
- **`api-channels-curated.test.ts`** — the route serves `curated.channels` with
  the CORS + cache headers (mock the JSON import).
- The headless play-test is integration-level; verified by a **manual smoke run**
  that prints the summary. No unit test for the browser step.

## Out of scope (noted for later)
- AbemaTV's bundled EPG (`url-tvg`) — could widen JP now/next coverage; fold into
  the EPG epic, not here.
- Recovering Pluto via native-HLS player path — unnecessary once validation
  excludes them; revisit only if Pluto coverage is wanted.
- Scheduling/automating the validator (cron / reminder) — manual local run for v1.

## Risks
- **First deploy needs a curated.json** — generate and commit one as the final
  implementation step (run the validator once).
- **Puppeteer Chromium download** — dev machines only; ~one-time.
- **Validator runtime ~30 min** for the pool — acceptable for a periodic run;
  tunable via concurrency.
- **AbemaTV ToS** — preview endpoints of a commercial service; personal-use call.
