# Stream Fallback — Design

**Date:** 2026-06-21
**Status:** Implemented on branch `stream-fallback`
**Branch:** `stream-fallback`

> **Post-implementation note:** actuals ran higher than the estimates below —
> **2,287** channels carry alternates (est. ~1,800) and the artifact grew by
> ~1 MB to 2.1 MB (est. ~+300 KB), because the cap-4 collection captured more
> per channel than projected. Benign; not a regression.

## Problem

Many channels show "Stream unavailable" even though iptv-org publishes a working
backup source for them. We parse `index.m3u`, which carries exactly **one** URL
per channel, and play only that URL. When it's dead, we surface the error and
stop.

iptv-org also publishes `streams.json` (15,782 streams for 9,278 channels):
**1,887 channels (~20%) have 2+ alternate URLs** that we currently ignore.

## Goal

When a channel's stream fails, silently fall back to the next known URL before
giving up. Stay entirely within iptv-org's legitimate data. No new UI controls,
no remote interaction — fully automatic and TV-appropriate.

Out of scope (explicitly rejected during brainstorming): build-time dead-stream
pruning, and external (non-iptv-org) playlist sources.

## Approach

Build-time ingest of alternate URLs + automatic in-player fallback. This fits the
existing architecture (build-time `enrichment.json`, the `planRecovery` seam) and
adds no request-time cost.

### 1. Data model & build pipeline

`Channel.streamUrl: string` becomes **`streamUrls: string[]`** — primary first,
then alternates.

- **`MAX_SOURCES = 4`** (1 primary + up to 3 backups). Caps both the stored data
  and the player's attempts, bounding worst-case failover time and artifact size.
- **Build** (`scripts/gen-channels.ts` + `buildEnrichment` in `lib/enrich.ts`):
  `streams.json` is already loaded for quality. Group its entries by base channel
  id and collect every stream URL, **same-feed entries first**. Store on each
  enrichment entry as `urls?: string[]`, capped at `MAX_SOURCES`. Skip streams
  whose `channel` is null. Expected artifact growth: ~+300 KB (acceptable; it's
  build-time bundled).
- **Runtime** (`applyEnrichment` in `lib/enrich.ts`):
  `streamUrls = dedupe([ m3uUrl, ...entry.urls ]).slice(0, MAX_SOURCES)`. The M3U
  URL stays the primary (iptv-org's canonical pick); alternates follow; duplicates
  dropped. Channels with no alternates get a 1-element array, so their behavior is
  unchanged.

### 2. Player fallback logic

`VideoPlayer` takes **`srcs: string[]`** instead of `src` and owns an internal
source index that resets to 0 when the channel (the `srcs` identity) changes. All
playback/error logic stays in this one cohesive "playback surface"; `WatchView`
just passes `srcs={active.streamUrls}`.

On a terminal failure:

- **Never started playing** (still `loading` — dead source: manifest load
  error/timeout, connection refused, or the existing 15 s hard cap) → **advance
  immediately to the next source.** No wasted `restartLoad` retries on a dead URL.
- **Was playing, then died** (mid-stream hiccup) → existing `planRecovery`
  (`restartLoad` / `recoverMedia`) on the *same* URL; only if that gives up do we
  advance to the next source.
- **Sources exhausted** → the existing `error` state
  ("Stream unavailable — try another channel").

A small pure helper in `lib/player.ts`, `nextSource(idx, total)`, returns the next
index or `null` when exhausted — unit-testable without hls.js.

### 3. UX

Fully automatic; no new buttons.

- While rolling to a backup, the centered text reads **"Trying another source…"**
  instead of "Loading…", so it never looks frozen. No counter (would expose
  internals and add noise).
- First source loads exactly as today ("Loading…").
- Only when all sources are exhausted does "Stream unavailable — try another
  channel" appear.

## Error handling summary

| Situation | Action |
| --- | --- |
| Source fails before playback starts | Advance to next source immediately |
| Source plays then hiccups (fatal) | `planRecovery` on same URL; on give-up, advance |
| Last source fails | Show "Stream unavailable" |
| 15 s hard cap, never started | Treat as dead → advance |
| Channel changed | Reset source index to 0 |

## Testing

**Pure helpers (`__tests__/player.test.ts`):**
- `MAX_SOURCES` constant.
- `nextSource(idx, total)` → next index, or `null` when exhausted / at cap.

**Build/data (`__tests__/enrich.test.ts`, `__tests__/m3u.test.ts`):**
- `buildEnrichment` collects alternate URLs per channel, same-feed first, capped,
  skips null-channel streams.
- `applyEnrichment` produces `streamUrls` = M3U primary + deduped alternates,
  capped; 1-element array when no alternates.
- `parseM3U` yields a 1-element `streamUrls`.

## Files touched

- `src/lib/types.ts` — `streamUrl` → `streamUrls: string[]`
- `src/lib/m3u.ts` — emit a 1-element `streamUrls`
- `src/lib/enrich.ts` — collect/merge alternate URLs; `EnrichmentEntry.urls?`
- `src/lib/player.ts` — `MAX_SOURCES`, `nextSource` helper
- `scripts/gen-channels.ts` — gather stream URLs per channel
- `src/data/enrichment.json` — regenerated
- `src/components/VideoPlayer.tsx` — `srcs` prop + internal fallback
- `src/components/WatchView.tsx` — pass `srcs={active.streamUrls}`
- Tests above + any fixtures referencing `streamUrl`

## Notes / risks

- **Breaking rename** (`streamUrl` → `streamUrls`) ripples across several files
  and test fixtures. Straightforward but must be done consistently.
- Worst-case failover time is bounded by `MAX_SOURCES` × per-source failure time;
  dead sources usually fail well under the 15 s cap, so real-world failover is
  fast. The cap keeps a fully-dead channel from hanging.
