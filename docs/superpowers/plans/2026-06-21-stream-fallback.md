# Stream Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a channel's stream fails, silently fall back to the next known iptv-org URL before showing "Stream unavailable".

**Architecture:** Build-time ingest of alternate stream URLs from iptv-org's `streams.json` into `enrichment.json`; `Channel` carries `streamUrls: string[]` (primary first). The player tries them in order, advancing on failure, capped at 4 sources. Reuses the existing build-time enrichment pipeline and the `planRecovery` recovery seam.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, hls.js, Vitest + Testing Library.

## Global Constraints

- `MAX_SOURCES = 4` (1 primary + up to 3 backups) — caps both the stored data and the player's failover attempts.
- The M3U URL is always the **primary** (index 0); alternates follow; duplicates dropped.
- Stay entirely within iptv-org data (`streams.json`). No external sources, no UI controls, no remote interaction.
- The `streamUrl` → `streamUrls` rename is breaking and must be applied consistently — the suite must stay green at the end of each task.
- This is a modified Next.js 16; if unsure about an API, read `node_modules/next/dist/docs/` before writing code.

---

### Task 1: Rename `streamUrl` → `streamUrls: string[]`

Atomic rename so the type, the parser, the one consumer, and all test fixtures land together and the suite stays green. The player still plays a single URL here (`streamUrls[0]`); real fallback comes in Task 5.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/m3u.ts:42`
- Modify: `src/components/WatchView.tsx` (the `<VideoPlayer src=…>` line)
- Modify: `__tests__/m3u.test.ts`
- Modify (fixtures): `__tests__/filters.test.ts`, `__tests__/enrich.test.ts`, `__tests__/CategoryRow.test.tsx`, `__tests__/search.test.ts`, `__tests__/ChannelCard.test.tsx`, `__tests__/channels-client.test.ts`

**Interfaces:**
- Produces: `Channel.streamUrls: string[]` (replaces `streamUrl: string`).

- [ ] **Step 1: Update the failing test first (m3u)**

In `__tests__/m3u.test.ts`, change the assertion at line 20:

```typescript
    expect(bbc.streamUrls).toEqual(["http://example.com/bbc.m3u8"]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/m3u.test.ts`
Expected: FAIL — `streamUrls` is undefined / type error (still `streamUrl`).

- [ ] **Step 3: Update the type**

In `src/lib/types.ts`, replace the `streamUrl` field:

```typescript
export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrls: string[];
  category: string;
  languages: string[];
  countries: string[];
  quality?: string | null;
};
```

- [ ] **Step 4: Update the parser**

In `src/lib/m3u.ts`, line 42, change `streamUrl: url,` to:

```typescript
      streamUrls: [url],
```

- [ ] **Step 5: Update the consumer (temporary single-URL)**

In `src/components/WatchView.tsx`, change the VideoPlayer `src` prop to read the first URL (full array wiring is Task 5):

```tsx
        src={active.streamUrls[0]}
```

- [ ] **Step 6: Update all test fixtures**

Each fixture below currently sets `streamUrl: …`. Replace with `streamUrls: […]`:

- `__tests__/filters.test.ts:7` → `streamUrls: [],`
- `__tests__/enrich.test.ts:41` → `streamUrls: ["u"],`
- `__tests__/CategoryRow.test.tsx:8` → `streamUrls: ["http://x/" + id],`
- `__tests__/search.test.ts:6` → `streamUrls: ["http://x/" + id],`
- `__tests__/ChannelCard.test.tsx:9` → `streamUrls: ["http://x/a.m3u8"],`
- `__tests__/channels-client.test.ts:6` → `streamUrls: ["http://x/a"],`

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/m3u.ts src/components/WatchView.tsx __tests__/
git commit -m "refactor: Channel.streamUrl -> streamUrls (string array)"
```

---

### Task 2: Collect alternate URLs in enrichment

Add the `url` field to `RawStream`, collect all stream URLs per channel (same-feed first, deduped, capped) in `buildEnrichment`, and merge them M3U-first in `applyEnrichment`.

**Files:**
- Modify: `src/lib/enrich.ts`
- Modify: `__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `Channel.streamUrls` (Task 1).
- Produces: `MAX_SOURCES` constant; `EnrichmentEntry.urls?: string[]`; `RawStream.url: string`; `applyEnrichment` populates `streamUrls`.

- [ ] **Step 1: Write the failing tests**

In `__tests__/enrich.test.ts`, first add `url` to the existing `buildEnrichment` streams fixture (around line 73) so it compiles, then update the existing equality assertion and add new tests.

Change the streams fixture:

```typescript
  const streams: RawStream[] = [
    { channel: "CNN.us", feed: "HD", url: "https://cnn-hd.m3u8", quality: "1080p" },
  ];
```

Update the existing "joins metadata" assertion to include `urls`:

```typescript
  it("joins metadata onto the M3U id (channel@feed)", () => {
    const map = buildEnrichment(["CNN.us@HD"], channels, logos, streams);
    expect(map["CNN.us@HD"]).toEqual({
      category: "News", country: "US", logo: "cnn.svg", quality: "1080p",
      languages: ["English"], urls: ["https://cnn-hd.m3u8"],
    });
  });
```

Add these new tests at the end of the `buildEnrichment` describe block:

```typescript
  it("collects multiple stream URLs, same-feed first, capped at MAX_SOURCES", () => {
    const many: RawStream[] = [
      { channel: "X.us", feed: null, url: "u-other", quality: null },
      { channel: "X.us", feed: "HD", url: "u-hd-1", quality: null },
      { channel: "X.us", feed: "HD", url: "u-hd-2", quality: null },
      { channel: "X.us", feed: "HD", url: "u-hd-3", quality: null },
      { channel: "X.us", feed: "HD", url: "u-hd-4", quality: null },
    ];
    const map = buildEnrichment(["X.us@HD"], [{ id: "X.us", country: null, categories: [], languages: [] }], [], many);
    // same-feed (HD) first, then others, capped at 4
    expect(map["X.us@HD"].urls).toEqual(["u-hd-1", "u-hd-2", "u-hd-3", "u-hd-4"]);
  });

  it("de-duplicates repeated URLs", () => {
    const dup: RawStream[] = [
      { channel: "X.us", feed: null, url: "same", quality: null },
      { channel: "X.us", feed: null, url: "same", quality: null },
    ];
    const map = buildEnrichment(["X.us"], [{ id: "X.us", country: null, categories: [], languages: [] }], [], dup);
    expect(map["X.us"].urls).toEqual(["same"]);
  });
```

Add these to the `applyEnrichment` describe block:

```typescript
  it("merges alternate URLs after the M3U primary, deduped and capped", () => {
    const out = applyEnrichment(
      [chan({ streamUrls: ["m3u-url"] })],
      { "CNN.us@HD": { urls: ["m3u-url", "alt-1", "alt-2", "alt-3", "alt-4"] } },
    );
    // m3u-url stays first; the duplicate alt copy of it is dropped; capped at 4
    expect(out[0].streamUrls).toEqual(["m3u-url", "alt-1", "alt-2", "alt-3"]);
  });

  it("keeps the lone M3U URL when enrichment has no alternates", () => {
    const out = applyEnrichment([chan({ streamUrls: ["only"] })], { "CNN.us@HD": { category: "News" } });
    expect(out[0].streamUrls).toEqual(["only"]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: FAIL — `RawStream` has no `url`, `urls` undefined, `MAX_SOURCES` logic absent.

- [ ] **Step 3: Implement the enrich.ts changes**

In `src/lib/enrich.ts`:

Add the constant near the top (after the imports):

```typescript
// Max stream URLs kept per channel (1 primary + up to 3 backups). Caps the
// stored artifact and the player's failover attempts.
export const MAX_SOURCES = 4;

const dedupe = (arr: string[]): string[] => [...new Set(arr)];
```

Add `url` to `RawStream` and `urls` to `EnrichmentEntry`:

```typescript
export type RawStream = { channel: string | null; feed: string | null; url: string; quality: string | null };
export type EnrichmentEntry = { category?: AppCategory; country?: string; logo?: string; quality?: string; languages?: string[]; urls?: string[] };
```

Add this helper above `buildEnrichment`:

```typescript
// URLs for a channel, same-feed first (the M3U id's @feed), then others as
// backups; deduped and capped. Other/null-feed streams are still valid backups.
function collectUrls(streams: RawStream[], feed: string | null): string[] {
  const ordered = [
    ...streams.filter((s) => feed != null && s.feed === feed),
    ...streams.filter((s) => feed == null || s.feed !== feed),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of ordered) {
    if (s.url && !seen.has(s.url)) { seen.add(s.url); out.push(s.url); }
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}
```

In `buildEnrichment`, add a per-channel stream grouping next to the existing `streamByKey` build:

```typescript
  const streamsByChannel = new Map<string, RawStream[]>();
  for (const s of streams) {
    if (!s.channel) continue;
    const arr = streamsByChannel.get(s.channel) ?? [];
    arr.push(s);
    streamsByChannel.set(s.channel, arr);
  }
```

Inside the `for (const id of m3uIds)` loop, after the `quality` block and before the `languages` line, add:

```typescript
    const urls = collectUrls(streamsByChannel.get(base) ?? [], feed);
    if (urls.length) entry.urls = urls;
```

Replace `applyEnrichment` with the URL-merging version:

```typescript
export function applyEnrichment(channels: Channel[], map: EnrichmentMap): Channel[] {
  return channels.map((c) => {
    const e = map[c.id];
    if (!e) return c;
    const streamUrls = e.urls?.length
      ? dedupe([...c.streamUrls, ...e.urls]).slice(0, MAX_SOURCES)
      : c.streamUrls;
    return {
      ...c,
      category: e.category ?? c.category,
      countries: e.country ? [e.country] : c.countries,
      languages: e.languages?.length ? e.languages : c.languages,
      logo: e.logo ?? c.logo,
      quality: e.quality ?? c.quality,
      streamUrls,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/enrich.test.ts && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts __tests__/enrich.test.ts
git commit -m "feat: collect alternate stream URLs into enrichment"
```

---

### Task 3: Regenerate `enrichment.json` with alternate URLs

The build script `scripts/gen-channels.ts` already reads `streams.json`; once Task 2's `buildEnrichment` collects URLs, regenerating the artifact picks them up. (`RawStream` now requires `url`, which the real `streams.json` provides.)

**Files:**
- Modify: `src/data/enrichment.json` (regenerated)

- [ ] **Step 1: Regenerate the artifact**

Run: `npx tsx scripts/gen-channels.ts`
Expected: a line like `[gen] ids=… enriched=… -> src/data/enrichment.json` (non-zero enriched count).

- [ ] **Step 2: Verify alternates landed**

Run: `node -e "const m=require('./src/data/enrichment.json'); const w=Object.values(m).filter(e=>e.urls&&e.urls.length>1).length; console.log('entries with 2+ urls:', w);"`
Expected: a count in the hundreds–low thousands (≈1,800 channels have alternates).

- [ ] **Step 3: Verify the app still builds and tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/enrichment.json
git commit -m "chore: regenerate enrichment.json with alternate stream URLs"
```

---

### Task 4: `nextSource` helper

A pure helper that picks the next source index or signals exhaustion — unit-testable without hls.js.

**Files:**
- Modify: `src/lib/player.ts`
- Modify: `__tests__/player.test.ts`

**Interfaces:**
- Produces: `nextSource(idx: number, total: number): number | null`.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/player.test.ts` (import `nextSource` from `@/lib/player` alongside the existing imports):

```typescript
import { nextSource } from "@/lib/player";

describe("nextSource", () => {
  it("advances to the next index", () => {
    expect(nextSource(0, 3)).toBe(1);
    expect(nextSource(1, 3)).toBe(2);
  });
  it("returns null at the last source", () => {
    expect(nextSource(2, 3)).toBeNull();
  });
  it("returns null for a single source", () => {
    expect(nextSource(0, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run __tests__/player.test.ts`
Expected: FAIL — `nextSource` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `src/lib/player.ts`:

```typescript
// Next stream-source index to try, or null when all sources are exhausted.
export function nextSource(idx: number, total: number): number | null {
  return idx + 1 < total ? idx + 1 : null;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run __tests__/player.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/player.ts __tests__/player.test.ts
git commit -m "feat: add nextSource helper for stream failover"
```

---

### Task 5: Player fallback wiring

Make `VideoPlayer` take the full URL list and advance through sources on failure; wire `WatchView` to pass the array. `VideoPlayer` has no unit test (hls.js + jsdom), so this task is verified by typecheck, lint, build, the full suite, and a manual smoke check.

**Files:**
- Modify: `src/components/VideoPlayer.tsx`
- Modify: `src/components/WatchView.tsx`

**Interfaces:**
- Consumes: `Channel.streamUrls` (Task 1), `nextSource` (Task 4), existing `hlsConfig`/`planRecovery`.

- [ ] **Step 1: Rewrite VideoPlayer to take `srcs` and fail over**

Replace `src/components/VideoPlayer.tsx` with:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Level } from "./QualitySelector";
import { hlsConfig, planRecovery, nextSource, type FatalKind, type RecoveryState } from "@/lib/player";

type Status = "loading" | "playing" | "error";

// Playback surface only. Play/pause, volume, and quality are driven by props so
// the PlayerOverlay owns the UI. Given several candidate URLs for the channel,
// it plays the first and silently advances to the next when one fails — only
// showing "Stream unavailable" once every source is exhausted. Keyed by channel
// id upstream, so it remounts (source index back to 0) on a channel change.
export function VideoPlayer({
  srcs, paused = false, volume = 1, muted = false, currentLevel = -1, onLevels,
}: {
  srcs: string[];
  paused?: boolean;
  volume?: number;
  muted?: boolean;
  currentLevel?: number;
  onLevels?: (levels: Level[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Bounded fatal-error recovery budget; reset per source + on successful play.
  const recovery = useRef<RecoveryState>({ network: 0, media: 0 });
  const [sourceIdx, setSourceIdx] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  // Distinct from `status`: a mid-playback stall while already playing.
  const [buffering, setBuffering] = useState(false);
  const src = srcs[sourceIdx] ?? srcs[0];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setBuffering(false);
    recovery.current = { network: 0, media: 0 };
    // A source that fails before it ever starts is dead -> advance immediately;
    // one that dies mid-playback gets planRecovery first.
    let started = false;

    // Move to the next source, or surface the error when none are left.
    const fail = () => {
      const next = nextSource(sourceIdx, srcs.length);
      if (next === null) setStatus("error");
      else setSourceIdx(next);
    };

    // Hard cap: a source that neither plays nor errors within 15s is treated as
    // dead (covers servers that accept the connection but never respond).
    const timer = setTimeout(() => { if (!started) fail(); }, 15_000);

    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig());
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        onLevels?.(data.levels.map((l) => ({ height: l.height })));
        video.play().then(() => { started = true; setStatus("playing"); }).catch(() => {});
      });
      // A buffered fragment means recovery (if any) worked — refresh the budget.
      hls.on(Hls.Events.FRAG_BUFFERED, () => { recovery.current = { network: 0, media: 0 }; });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return; // non-fatal errors self-heal
        if (!started) { fail(); return; } // dead source -> next source
        const kind: FatalKind =
          data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network"
          : data.type === Hls.ErrorTypes.MEDIA_ERROR ? "media"
          : "other";
        const { action, state } = planRecovery(kind, recovery.current);
        recovery.current = state;
        if (action === "restartLoad") hls.startLoad();
        else if (action === "recoverMedia") hls.recoverMediaError();
        else fail();
      });
      return () => { clearTimeout(timer); hls.destroy(); hlsRef.current = null; };
    }

    // Safari / native HLS
    video.src = src;
    const onLoaded = () => { started = true; setStatus("playing"); };
    const onErr = () => fail();
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onErr);
    video.play().catch(() => {});
    return () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onErr);
    };
  }, [src, sourceIdx, srcs, onLevels]);

  // Buffering indicator: `waiting` stalls, `playing`/`canplay` resume. Native
  // media events, so they cover both the hls.js and Safari paths. Attached once.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setBuffering(true);
    const onResume = () => setBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onResume);
    video.addEventListener("canplay", onResume);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onResume);
      video.removeEventListener("canplay", onResume);
    };
  }, []);

  // Reflect play/pause intent. Resuming a live stream lets hls.js catch back up.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused]);

  // Reflect volume / mute (mainly for the desktop browser; TVs use the remote).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  // Reflect the chosen quality level (-1 = Auto/ABR).
  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = currentLevel;
  }, [currentLevel]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <video ref={videoRef} style={{ width: "100%", height: "100%" }} controls={false} />
      {status === "loading" && (
        <Centered>{sourceIdx > 0 ? "Trying another source…" : "Loading…"}</Centered>
      )}
      {status === "error" && <Centered>Stream unavailable — try another channel</Centered>}
      {status === "playing" && buffering && (
        <Centered><span className="ltv-spinner" role="status" aria-label="Buffering" /></Centered>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18,
    }}>{children}</div>
  );
}
```

- [ ] **Step 2: Wire WatchView to pass the array**

In `src/components/WatchView.tsx`, change the `<VideoPlayer …>` usage from `src={active.streamUrls[0]}` to pass the whole list and key by channel id:

```tsx
      <VideoPlayer
        key={active.id}
        srcs={active.streamUrls}
        paused={paused}
        volume={volume}
        muted={muted}
        currentLevel={currentLevel}
        onLevels={setLevels}
      />
```

- [ ] **Step 3: Typecheck, lint, and run the full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors; lint clean except the pre-existing `<img>` warning in `ChannelCard.tsx`; all tests PASS.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: "Compiled successfully", all routes listed, no errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open a channel, confirm:
- A working channel plays as before ("Loading…" → video).
- A dead channel shows "Trying another source…" briefly (if it has alternates) before either playing or ending on "Stream unavailable — try another channel".
- Switching channels resets cleanly (no stale "Trying another source…").

- [ ] **Step 6: Commit**

```bash
git add src/components/VideoPlayer.tsx src/components/WatchView.tsx
git commit -m "feat: automatic stream failover in the player"
```

---

## Self-Review

**Spec coverage:**
- Data model (`streamUrls`, `MAX_SOURCES`, M3U-first) → Tasks 1, 2.
- Build pipeline (collect alternates, same-feed first, capped, skip null channel) → Task 2; regenerate → Task 3.
- Player fallback (never-started → advance; mid-play → planRecovery then advance; exhausted → error; 15s cap; reset on channel change) → Task 5.
- UX ("Trying another source…", unchanged first-load and final-error copy) → Task 5 render block.
- Testing (nextSource, buildEnrichment, applyEnrichment, parseM3U) → Tasks 1, 2, 4.

**Placeholder scan:** none — every code step shows complete code; every run step shows the command and expected result.

**Type consistency:** `streamUrls: string[]` (Task 1) is consumed by `applyEnrichment` (Task 2), `WatchView` (Tasks 1, 5), and `VideoPlayer.srcs` (Task 5). `RawStream.url` and `EnrichmentEntry.urls` (Task 2) are produced by `buildEnrichment` and consumed by `applyEnrichment` (Task 2) and the real `streams.json` (Task 3). `nextSource(idx, total)` (Task 4) is called in `VideoPlayer` (Task 5). `MAX_SOURCES` lives in `enrich.ts` (Task 2) and bounds both the data and, transitively (via array length), the player's attempts.
