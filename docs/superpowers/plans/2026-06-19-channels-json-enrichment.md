# Channel Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the M3U channel list with iptv-org canonical category, country, best logo, and stream quality via a build-time slim lookup.

**Architecture:** `index.m3u` stays the runtime spine (fresh stream URLs + stable `channel@feed` ids). A build-time script joins channels.json + logos.json + streams.json into a slim `src/data/enrichment.json` keyed by the exact M3U id; `source.ts` merges it onto parsed channels at request time. All join/pick logic lives in pure, unit-tested functions; the generator and component edits are thin glue.

**Tech Stack:** TypeScript, Next 16 App Router, Vitest, Node fetch.

## Global Constraints

- `index.m3u` is the ONLY required source; all enrichment is best-effort — a missing/empty `enrichment.json` must degrade to bare-M3U behavior, never error.
- `Channel.id` format (`channel@feed`, or `slug(name)` for unmapped) is UNCHANGED — favorites/recents depend on it.
- Enrichment merge precedence: enrichment value when present, else M3U-derived fallback.
- `enrichment.json` is keyed by the runtime `Channel.id` (`channel@feed`), derived by reusing `parseM3U` — never re-derive ids elsewhere.
- TDD: pure functions get a failing test first. Generator script + ChannelCard chip are glue (no new tests), mirroring `scripts/build-epg-channels.ts`.
- Tests run with `npx vitest run <file>`.

---

### Task 1: Canonical category mapping

**Files:**
- Modify: `src/lib/categories.ts`
- Test: `__tests__/categories.test.ts`

**Interfaces:**
- Consumes: `AppCategory` from `src/lib/types.ts`.
- Produces: `canonicalCategory(ids: string[]): AppCategory | undefined` — maps iptv-org canonical category ids to an `AppCategory`; `undefined` only when `ids` is empty (caller then uses the keyword fallback `toAppCategory`).

- [ ] **Step 1: Write the failing test**

Append to `__tests__/categories.test.ts`:

```ts
import { toAppCategory, canonicalCategory } from "@/lib/categories";

describe("canonicalCategory", () => {
  it("maps known canonical ids to AppCategory", () => {
    expect(canonicalCategory(["news"])).toBe("News");
    expect(canonicalCategory(["sports"])).toBe("Sports");
    expect(canonicalCategory(["music"])).toBe("Music");
    expect(canonicalCategory(["kids"])).toBe("Kids");
    expect(canonicalCategory(["movies"])).toBe("Entertainment");
  });
  it("applies priority when multiple categories are present", () => {
    // News outranks Entertainment; Kids outranks Music
    expect(canonicalCategory(["entertainment", "news"])).toBe("News");
    expect(canonicalCategory(["music", "kids"])).toBe("Kids");
  });
  it("returns Other when categories exist but none map to a named bucket", () => {
    expect(canonicalCategory(["business", "shop"])).toBe("Other");
  });
  it("returns undefined when there are no categories (use keyword fallback)", () => {
    expect(canonicalCategory([])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/categories.test.ts`
Expected: FAIL — `canonicalCategory is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/categories.ts`:

```ts
// iptv-org canonical category ids → our AppCategory. Content genres collapse
// into Entertainment; only a handful map to the named buckets.
const CANON: Record<string, AppCategory> = {
  news: "News",
  sports: "Sports",
  music: "Music",
  kids: "Kids", family: "Kids",
  entertainment: "Entertainment", movies: "Entertainment", series: "Entertainment",
  general: "Entertainment", comedy: "Entertainment", drama: "Entertainment",
  animation: "Entertainment", documentary: "Entertainment", culture: "Entertainment",
  lifestyle: "Entertainment", cooking: "Entertainment", travel: "Entertainment",
  classic: "Entertainment", relax: "Entertainment", outdoor: "Entertainment",
};
// Higher-priority categories win when a channel lists several.
const PRIORITY: AppCategory[] = ["News", "Sports", "Kids", "Music", "Entertainment"];

// undefined => no canonical data; caller falls back to toAppCategory(groups).
export function canonicalCategory(ids: string[]): AppCategory | undefined {
  if (ids.length === 0) return undefined;
  const mapped = ids.map((id) => CANON[id.toLowerCase()]).filter(Boolean) as AppCategory[];
  for (const cat of PRIORITY) if (mapped.includes(cat)) return cat;
  return "Other"; // has categories, but none are a named bucket
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/categories.test.ts`
Expected: PASS (all canonicalCategory + existing toAppCategory tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts __tests__/categories.test.ts
git commit -m "Add canonicalCategory: iptv-org category ids -> AppCategory"
```

---

### Task 2: Best-logo picker

**Files:**
- Create: `src/lib/enrich.ts`
- Test: `__tests__/enrich.test.ts`

**Interfaces:**
- Produces:
  - `type RawLogo = { channel: string; feed: string | null; in_use: boolean; tags: string[]; width: number; height: number; format: string; url: string }`
  - `bestLogo(logos: RawLogo[], feed?: string | null): string | undefined` — picks the best logo URL: in-use first, format SVG > WebP > PNG > other, larger area as tie-break, feed-specific preferred over channel-level when `feed` is given.

- [ ] **Step 1: Write the failing test**

Create `__tests__/enrich.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bestLogo, type RawLogo } from "@/lib/enrich";

const logo = (o: Partial<RawLogo>): RawLogo => ({
  channel: "X.us", feed: null, in_use: true, tags: [],
  width: 100, height: 100, format: "PNG", url: "u", ...o,
});

describe("bestLogo", () => {
  it("returns undefined for no logos", () => {
    expect(bestLogo([])).toBeUndefined();
  });
  it("prefers in_use logos over not-in-use", () => {
    const r = bestLogo([logo({ in_use: false, url: "off" }), logo({ in_use: true, url: "on" })]);
    expect(r).toBe("on");
  });
  it("prefers SVG over PNG", () => {
    const r = bestLogo([logo({ format: "PNG", url: "png" }), logo({ format: "SVG", url: "svg" })]);
    expect(r).toBe("svg");
  });
  it("breaks format ties by larger area", () => {
    const r = bestLogo([
      logo({ format: "PNG", width: 100, height: 100, url: "small" }),
      logo({ format: "PNG", width: 400, height: 300, url: "big" }),
    ]);
    expect(r).toBe("big");
  });
  it("prefers a feed-specific logo when feed is given", () => {
    const r = bestLogo(
      [logo({ feed: null, url: "chan" }), logo({ feed: "HD", url: "feed" })],
      "HD",
    );
    expect(r).toBe("feed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: FAIL — cannot find module `@/lib/enrich`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/enrich.ts`:

```ts
export type RawLogo = {
  channel: string; feed: string | null; in_use: boolean; tags: string[];
  width: number; height: number; format: string; url: string;
};

const FORMAT_RANK: Record<string, number> = { SVG: 3, WEBP: 2, PNG: 1 };

// Best logo URL for a channel: in-use first, then format (SVG scales for TV),
// then larger area. When `feed` is given, a feed-specific logo outranks the
// channel-level one.
export function bestLogo(logos: RawLogo[], feed?: string | null): string | undefined {
  if (logos.length === 0) return undefined;
  const score = (l: RawLogo): number =>
    (l.in_use ? 1_000_000 : 0) +
    (feed && l.feed === feed ? 500_000 : 0) +
    (FORMAT_RANK[l.format?.toUpperCase()] ?? 0) * 100_000 +
    Math.min(l.width * l.height, 99_999);
  return [...logos].sort((a, b) => score(b) - score(a))[0].url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts __tests__/enrich.test.ts
git commit -m "Add bestLogo picker (in-use/format/size/feed ranking)"
```

---

### Task 3: buildEnrichment join

**Files:**
- Modify: `src/lib/enrich.ts`
- Test: `__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `bestLogo`, `RawLogo` (Task 2); `canonicalCategory` (Task 1); `baseChannelId` from `src/lib/epg.ts`; `AppCategory` from `src/lib/types.ts`.
- Produces:
  - `type RawChannel = { id: string; country: string | null; categories: string[] }`
  - `type RawStream = { channel: string | null; feed: string | null; quality: string | null }`
  - `type EnrichmentEntry = { category?: AppCategory; country?: string; logo?: string; quality?: string }`
  - `type EnrichmentMap = Record<string, EnrichmentEntry>`
  - `buildEnrichment(m3uIds: string[], channels: RawChannel[], logos: RawLogo[], streams: RawStream[]): EnrichmentMap` — keyed by each M3U id (`channel@feed`); omits empty entries.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/enrich.test.ts`:

```ts
import { buildEnrichment, type RawChannel, type RawStream } from "@/lib/enrich";

describe("buildEnrichment", () => {
  const channels: RawChannel[] = [
    { id: "CNN.us", country: "US", categories: ["news"] },
  ];
  const logos: RawLogo[] = [
    { channel: "CNN.us", feed: null, in_use: true, tags: [], width: 300, height: 200, format: "SVG", url: "cnn.svg" },
  ];
  const streams: RawStream[] = [
    { channel: "CNN.us", feed: "HD", quality: "1080p" },
  ];

  it("joins metadata onto the M3U id (channel@feed)", () => {
    const map = buildEnrichment(["CNN.us@HD"], channels, logos, streams);
    expect(map["CNN.us@HD"]).toEqual({
      category: "News", country: "US", logo: "cnn.svg", quality: "1080p",
    });
  });
  it("matches quality by channel AND feed", () => {
    const map = buildEnrichment(["CNN.us@SD"], channels, logos, streams);
    expect(map["CNN.us@SD"].quality).toBeUndefined(); // no SD stream
    expect(map["CNN.us@SD"].country).toBe("US");      // metadata still joins
  });
  it("omits ids with no matching channel entirely", () => {
    const map = buildEnrichment(["Unknown.zz"], channels, logos, streams);
    expect(map["Unknown.zz"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: FAIL — `buildEnrichment is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add these imports at the TOP of `src/lib/enrich.ts` (ESLint `import/first` — keep all imports above the existing `RawLogo`/`bestLogo` code):

```ts
import { canonicalCategory } from "./categories";
import { baseChannelId } from "./epg";
import type { AppCategory } from "./types";
```

Then append the rest to `src/lib/enrich.ts`:

```ts
export type RawChannel = { id: string; country: string | null; categories: string[] };
export type RawStream = { channel: string | null; feed: string | null; quality: string | null };
export type EnrichmentEntry = { category?: AppCategory; country?: string; logo?: string; quality?: string };
export type EnrichmentMap = Record<string, EnrichmentEntry>;

const feedOf = (id: string): string | null => (id.includes("@") ? id.split("@")[1] : null);

export function buildEnrichment(
  m3uIds: string[], channels: RawChannel[], logos: RawLogo[], streams: RawStream[],
): EnrichmentMap {
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const logosByChannel = new Map<string, RawLogo[]>();
  for (const l of logos) {
    const arr = logosByChannel.get(l.channel) ?? [];
    arr.push(l);
    logosByChannel.set(l.channel, arr);
  }
  const streamByKey = new Map<string, RawStream>();
  for (const s of streams) {
    if (s.channel) streamByKey.set(`${s.channel}@${s.feed ?? ""}`, s);
  }

  const map: EnrichmentMap = {};
  for (const id of m3uIds) {
    const base = baseChannelId(id);
    const ch = channelById.get(base);
    if (!ch) continue; // unmapped -> falls back to M3U at runtime
    const feed = feedOf(id);
    const entry: EnrichmentEntry = {};
    const cat = canonicalCategory(ch.categories);
    if (cat) entry.category = cat;
    if (ch.country) entry.country = ch.country;
    const logo = bestLogo(logosByChannel.get(base) ?? [], feed);
    if (logo) entry.logo = logo;
    const quality = streamByKey.get(`${base}@${feed ?? ""}`)?.quality;
    if (quality) entry.quality = quality;
    if (Object.keys(entry).length) map[id] = entry;
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts __tests__/enrich.test.ts
git commit -m "Add buildEnrichment: join M3U ids to channels/logos/streams"
```

---

### Task 4: Extend Channel with quality; M3U default

**Files:**
- Modify: `src/lib/types.ts:1-9`
- Modify: `src/lib/m3u.ts:38-47`
- Test: `__tests__/m3u.test.ts`

**Interfaces:**
- Produces: `Channel.quality?: string | null` — OPTIONAL so the existing `Channel` fixtures in 6 test files need no change; `parseM3U` still sets it explicitly to `null`, and the source-layer merge fills it.

- [ ] **Step 1: Write the failing test**

Append a case to `__tests__/m3u.test.ts` (inside the existing top-level `describe`, or add one):

```ts
import { parseM3U } from "@/lib/m3u";

it("sets quality to null on freshly parsed channels", () => {
  const m3u = `#EXTM3U\n#EXTINF:-1 tvg-id="CNN.us",CNN\nhttp://x/cnn.m3u8`;
  expect(parseM3U(m3u)[0].quality).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/m3u.test.ts`
Expected: FAIL — `quality` is `undefined`, not `null` (and a TS error until the type is added).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/types.ts`, add `quality` to `Channel`:

```ts
export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  category: string;
  languages: string[];
  countries: string[];
  quality?: string | null;
};
```

In `src/lib/m3u.ts`, add `quality: null` to the pushed object:

```ts
    channels.push({
      id,
      name,
      logo: attr(line, "tvg-logo"),
      streamUrl: url,
      category: toAppCategory(group ? group.split(";") : []),
      languages,
      countries,
      quality: null,
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/m3u.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/m3u.ts __tests__/m3u.test.ts
git commit -m "Add Channel.quality (null from M3U; filled by enrichment)"
```

---

### Task 5: applyEnrichment + wire into source

**Files:**
- Modify: `src/lib/enrich.ts`
- Create: `src/data/enrichment.json` (initial `{}`)
- Modify: `src/lib/source.ts`
- Test: `__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `Channel` from `src/lib/types.ts`; `EnrichmentMap` (Task 3).
- Produces: `applyEnrichment(channels: Channel[], map: EnrichmentMap): Channel[]` — returns new channels with enrichment merged by `id`; absent id or absent field keeps the M3U value.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/enrich.test.ts`:

```ts
import { applyEnrichment } from "@/lib/enrich";
import type { Channel } from "@/lib/types";

const chan = (o: Partial<Channel>): Channel => ({
  id: "CNN.us@HD", name: "CNN", logo: "m3u-logo", streamUrl: "u",
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("applyEnrichment", () => {
  it("overrides logo/category/country/quality when enrichment has them", () => {
    const out = applyEnrichment([chan({})], {
      "CNN.us@HD": { category: "News", country: "US", logo: "good.svg", quality: "1080p" },
    });
    expect(out[0]).toMatchObject({
      category: "News", countries: ["US"], logo: "good.svg", quality: "1080p",
    });
  });
  it("keeps M3U values when the id is absent from the map", () => {
    const out = applyEnrichment([chan({})], {});
    expect(out[0]).toMatchObject({ logo: "m3u-logo", category: "Other", quality: null });
  });
  it("keeps M3U logo when enrichment entry omits logo", () => {
    const out = applyEnrichment([chan({})], { "CNN.us@HD": { category: "News" } });
    expect(out[0].logo).toBe("m3u-logo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/enrich.test.ts`
Expected: FAIL — `applyEnrichment is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add `import type { Channel } from "./types";` to the TOP of `src/lib/enrich.ts` (with the other imports), then append the function:

```ts
// Merge enrichment onto channels by id. Enrichment wins where present; the
// channel's M3U-derived value is the fallback. `country` becomes a 1-element
// `countries` array (M3U country is usually empty).
export function applyEnrichment(channels: Channel[], map: EnrichmentMap): Channel[] {
  return channels.map((c) => {
    const e = map[c.id];
    if (!e) return c;
    return {
      ...c,
      category: e.category ?? c.category,
      countries: e.country ? [e.country] : c.countries,
      logo: e.logo ?? c.logo,
      quality: e.quality ?? c.quality,
    };
  });
}
```

Create `src/data/enrichment.json`:

```json
{}
```

Modify `src/lib/source.ts` to merge. Replace the body of `createChannelSource`'s returned function so it applies the bundled map:

```ts
import type { Channel } from "./types";
import { parseM3U } from "./m3u";
import { applyEnrichment, type EnrichmentMap } from "./enrich";
import enrichment from "@/data/enrichment.json";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

export function createChannelSource(fetcher: Fetcher = defaultFetcher) {
  let cache: { channels: Channel[]; at: number } | null = null;
  return async (): Promise<Channel[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
    const text = await fetcher(PLAYLIST_URL);
    const channels = applyEnrichment(parseM3U(text), enrichment as EnrichmentMap);
    cache = { channels, at: Date.now() };
    return channels;
  };
}

export const getChannels = createChannelSource();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/enrich.test.ts __tests__/m3u.test.ts __tests__/api-channels.test.ts`
Expected: PASS (merge works; with empty `{}` map, source behaves as before).

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.ts src/lib/source.ts src/data/enrichment.json
git commit -m "Merge enrichment onto channels in source.ts (empty map = no-op)"
```

---

### Task 6: Generator script + real artifact

**Files:**
- Create: `scripts/gen-channels.ts`
- Modify: `package.json` (add `gen:channels` script)
- Modify: `src/data/enrichment.json` (regenerated with real data)

**Interfaces:**
- Consumes: `parseM3U` (`src/lib/m3u.ts`), `buildEnrichment` + raw types (`src/lib/enrich.ts`).
- Produces: a populated `src/data/enrichment.json`.

- [ ] **Step 1: Write the generator**

Create `scripts/gen-channels.ts`:

```ts
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
```

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, add:

```json
    "gen:channels": "tsx scripts/gen-channels.ts",
```

- [ ] **Step 3: Generate the real artifact**

Run: `npx tsx scripts/gen-channels.ts`
Expected: log like `[gen] ids=9720 enriched=~9180 -> src/data/enrichment.json`, and `src/data/enrichment.json` is now several hundred KB–~2 MB.

- [ ] **Step 4: Verify the app still builds and tests pass**

Run: `npm test && npx tsc --noEmit`
Expected: all pass; types clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-channels.ts package.json src/data/enrichment.json
git commit -m "Add gen:channels generator and the real enrichment artifact"
```

---

### Task 7: Quality chip from enrichment data

**Files:**
- Modify: `src/components/ChannelCard.tsx`
- Test: `__tests__/ChannelCard.test.tsx`

**Interfaces:**
- Consumes: `Channel.quality` (Task 4).

- [ ] **Step 1: Write the failing test**

Add to `__tests__/ChannelCard.test.tsx` inside the existing `describe`. The chip renders `isHd(quality) ? "HD" : quality`, so use a non-HD value (`480p`) to assert the literal text, and a name with no `(…)` quality tag so it can only have come from `channel.quality`:

```ts
it("prefers channel.quality over the name-parsed quality on the chip", () => {
  render(<ChannelCard channel={{ ...ch, name: "Channel A", quality: "480p" }} onSelect={() => {}} />);
  expect(screen.getByText("480p")).toBeInTheDocument();
});
```

(`ch` is the fixture already defined at the top of the file; `quality` is optional on `Channel`, so the spread + override typechecks.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ChannelCard.test.tsx`
Expected: FAIL — `getByText("480p")` finds nothing, because the chip currently uses only the name-parsed quality (null for "Channel A").

- [ ] **Step 3: Wire quality preference**

In `src/components/ChannelCard.tsx`, change the destructure (line 13) to rename the parsed quality, then prefer the authoritative one:

```tsx
  const { title, quality: parsedQuality, flags } = parseChannelName(channel.name);
  const quality = channel.quality ?? parsedQuality; // authoritative first, name fallback
```

The existing chip JSX already references `quality` and `isHd(quality)`, so no further change is needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ChannelCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChannelCard.tsx __tests__/ChannelCard.test.tsx
git commit -m "ChannelCard: prefer authoritative channel.quality for the chip"
```

---

## Final verification

- [ ] Run full suite: `npm test` — all pass.
- [ ] Typecheck: `npx tsc --noEmit` — clean.
- [ ] Lint: `npm run lint` — no new errors.
- [ ] Build: `npm run build` — succeeds (confirms JSON import + bundling).
- [ ] Sanity: start `npm run dev`, open Home — logos sharper, categories sensible, quality chips present on enriched channels.
