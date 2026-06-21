# Multi-Source Playlist Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge a curated registry of M3U sources into one catalogue behind `/api/channels`, unioning stream URLs for the same channel (backups) and broadening coverage.

**Architecture:** A `sources.ts` registry drives `source.ts`, which fetches all sources in parallel (`Promise.allSettled`), parses each, applies per-source metadata defaults, then `mergeSources` collapses by channel identity (real `tvg-id` else normalized name + country), unioning `streamUrls` (https-upgraded, deduped, capped at `MAX_SOURCES`). Enrichment runs after merge, unchanged.

**Tech Stack:** Next.js 16 + React 19, TypeScript, Vitest.

## Global Constraints

- `MAX_SOURCES = 4` (already exported from `src/lib/enrich.ts`) bounds every channel's `streamUrls` after union + enrichment.
- Identity key: use `Channel.id` when it contains a `.` (a real `tvg-id` like `CNN.us`); otherwise `normalizeName(name) + "|" + (countries[0] ?? "")`.
- Registry order = priority; the **first** source to contribute a channel wins its metadata; later sources only append URLs and fill missing fields.
- All stored `streamUrls` are `https` (auto-upgrade `http://`→`https://` before union/dedup); the original `http://` is not kept.
- No adult keyword filter — adult content is avoided by source selection only.
- A failed source is skipped (`allSettled`); only if **all** sources fail do we throw.
- Starting registry order: iptv-org, Free-TV/IPTV, atsushi444 `jp.m3u`, atsushi444 `tv.m3u`.

---

### Task 1: Merge core — `merge.ts`

Pure functions: `httpsUpgrade`, `normalizeName`, `identityKey`, `mergeSources`. The heart of the feature; fully unit-testable.

**Files:**
- Create: `src/lib/merge.ts`
- Test: `__tests__/merge.test.ts`

**Interfaces:**
- Consumes: `MAX_SOURCES` from `@/lib/enrich`; `Channel` from `@/lib/types`.
- Produces: `httpsUpgrade(url: string): string`, `normalizeName(name: string): string`, `identityKey(c: Channel): string`, `mergeSources(lists: Channel[][]): Channel[]`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/merge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { httpsUpgrade, normalizeName, identityKey, mergeSources } from "@/lib/merge";
import type { Channel } from "@/lib/types";

const ch = (o: Partial<Channel>): Channel => ({
  id: "X", name: "X", logo: "", streamUrls: ["https://x"],
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("httpsUpgrade", () => {
  it("upgrades http to https", () => {
    expect(httpsUpgrade("http://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
  it("leaves https untouched", () => {
    expect(httpsUpgrade("https://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
});

describe("normalizeName", () => {
  it("strips quality/resolution tokens and non-alphanumerics", () => {
    expect(normalizeName("ESPN HD")).toBe("espn");
    expect(normalizeName("ESPN (1080p)")).toBe("espn");
  });
});

describe("identityKey", () => {
  it("keys on a real tvg-id (contains a dot)", () => {
    expect(identityKey(ch({ id: "CNN.us" }))).toBe("id:CNN.us");
  });
  it("keys on normalized name + country when id is a slug", () => {
    expect(identityKey(ch({ id: "some-channel", name: "Some Channel", countries: ["US"] })))
      .toBe("name:somechannel|US");
  });
});

describe("mergeSources", () => {
  it("unions stream URLs for the same tvg-id across sources, deduped + capped", () => {
    const a = [ch({ id: "CNN.us", streamUrls: ["https://1"] })];
    const b = [ch({ id: "CNN.us", streamUrls: ["https://2", "https://1"] })];
    const c = [ch({ id: "CNN.us", streamUrls: ["https://3"] })];
    const d = [ch({ id: "CNN.us", streamUrls: ["https://4"] })];
    const e = [ch({ id: "CNN.us", streamUrls: ["https://5"] })];
    const out = mergeSources([a, b, c, d, e]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2", "https://3", "https://4"]); // cap 4
  });

  it("merges by normalized name + same country", () => {
    const a = [ch({ id: "espn-slug", name: "ESPN", countries: ["US"], streamUrls: ["https://1"] })];
    const b = [ch({ id: "espn2", name: "ESPN HD", countries: ["US"], streamUrls: ["https://2"] })];
    const out = mergeSources([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("does NOT merge same name across different countries", () => {
    const a = [ch({ id: "s1", name: "Sport", countries: ["US"] })];
    const b = [ch({ id: "s2", name: "Sport", countries: ["GB"] })];
    expect(mergeSources([a, b])).toHaveLength(2);
  });

  it("unions grouped backups within a single source", () => {
    const a = [
      ch({ id: "CNN.us", streamUrls: ["https://1"] }),
      ch({ id: "CNN.us", streamUrls: ["https://2"] }),
    ];
    const out = mergeSources([a]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("https-upgrades urls before union (http+https for same path collapse)", () => {
    const a = [ch({ id: "CNN.us", streamUrls: ["http://x/a"] })];
    const b = [ch({ id: "CNN.us", streamUrls: ["https://x/a"] })];
    const out = mergeSources([a, b]);
    expect(out[0].streamUrls).toEqual(["https://x/a"]);
  });

  it("adds unmatched channels as new entries", () => {
    const a = [ch({ id: "A.us" })];
    const b = [ch({ id: "B.us" })];
    expect(mergeSources([a, b])).toHaveLength(2);
  });

  it("first source wins metadata; later sources fill only missing fields", () => {
    const a = [ch({ id: "CNN.us", logo: "first.png", category: "News", languages: ["English"], countries: ["US"] })];
    const b = [ch({ id: "CNN.us", logo: "second.png", category: "Sports", languages: ["French"], countries: ["FR"] })];
    const out = mergeSources([a, b]);
    expect(out[0]).toMatchObject({ logo: "first.png", category: "News", languages: ["English"], countries: ["US"] });
  });

  it("fills a missing field from a later source", () => {
    const a = [ch({ id: "CNN.us", logo: "", category: "Other", languages: [], countries: [] })];
    const b = [ch({ id: "CNN.us", logo: "got.png", category: "News", languages: ["English"], countries: ["US"] })];
    const out = mergeSources([a, b]);
    expect(out[0]).toMatchObject({ logo: "got.png", category: "News", languages: ["English"], countries: ["US"] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/merge.test.ts`
Expected: FAIL — `@/lib/merge` does not exist.

- [ ] **Step 3: Implement `src/lib/merge.ts`**

```ts
import type { Channel } from "./types";
import { MAX_SOURCES } from "./enrich";

// http:// streams are blocked by the browser on our HTTPS origin; upgrade to
// https:// so TLS-capable servers play (others fail and the player fails over).
export function httpsUpgrade(url: string): string {
  return url.startsWith("http://") ? "https://" + url.slice("http://".length) : url;
}

// Normalize a name for fuzzy cross-source identity: lowercase, drop
// resolution/quality tokens and non-alphanumerics ("ESPN HD" -> "espn").
const QUALITY = /\b(?:\d{3,4}p|[0-9]+k|hd|sd|fhd|uhd|hq|lq)\b/g;
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(QUALITY, " ").replace(/[^\p{L}\p{N}]+/gu, "");
}

// Merge identity: a real tvg-id (contains ".", e.g. "CNN.us") is the strong
// signal; else normalized name + primary country.
export function identityKey(c: Channel): string {
  if (c.id.includes(".")) return `id:${c.id}`;
  return `name:${normalizeName(c.name)}|${c.countries[0] ?? ""}`;
}

function capUrls(urls: string[]): string[] {
  return [...new Set(urls)].slice(0, MAX_SOURCES);
}

// Merge channels from several sources (priority order) into one catalogue. Same
// identity -> one channel; streamUrls = union (https-upgraded, deduped, capped).
// First source wins metadata; later ones fill only blank fields.
export function mergeSources(lists: Channel[][]): Channel[] {
  const byKey = new Map<string, Channel>();
  const order: string[] = [];
  for (const list of lists) {
    for (const c of list) {
      const key = identityKey(c);
      const existing = byKey.get(key);
      if (!existing) {
        order.push(key);
        byKey.set(key, { ...c, streamUrls: capUrls(c.streamUrls.map(httpsUpgrade)) });
        continue;
      }
      existing.streamUrls = capUrls([...existing.streamUrls, ...c.streamUrls.map(httpsUpgrade)]);
      if (!existing.logo && c.logo) existing.logo = c.logo;
      if (existing.languages.length === 0 && c.languages.length) existing.languages = c.languages;
      if (existing.countries.length === 0 && c.countries.length) existing.countries = c.countries;
      if (existing.category === "Other" && c.category !== "Other") existing.category = c.category;
    }
  }
  return order.map((k) => byKey.get(k)!);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/merge.test.ts && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merge.ts __tests__/merge.test.ts
git commit -m "feat: merge core (identity union, https upgrade, name normalize)"
```

---

### Task 2: `parseM3U` returns every entry (no within-source de-dupe)

De-dup/union now lives in `mergeSources`, so `parseM3U` must keep every `#EXTINF` (so grouped backups within a source survive).

**Files:**
- Modify: `src/lib/m3u.ts`
- Modify: `__tests__/m3u.test.ts`

**Interfaces:**
- Produces: `parseM3U(text)` returns one `Channel` per `#EXTINF` entry (dup ids preserved).

- [ ] **Step 1: Update the test first**

In `__tests__/m3u.test.ts`, replace the test named `"de-duplicates channels that share an id, keeping the first"` with:

```ts
  it("keeps every entry, including repeats of an id (merge layer de-dupes)", () => {
    // iptv sources sometimes list a channel several times (backup URLs); parseM3U
    // keeps them all and mergeSources unions them later.
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CNN.us" group-title="News",CNN One
http://x/1.m3u8
#EXTINF:-1 tvg-id="CNN.us" group-title="News",CNN Two
http://x/2.m3u8
`;
    const ch = parseM3U(m3u);
    expect(ch).toHaveLength(2);
    expect(ch.map((c) => c.streamUrls[0])).toEqual(["http://x/1.m3u8", "http://x/2.m3u8"]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/m3u.test.ts`
Expected: FAIL — current `parseM3U` de-dupes, returns length 1.

- [ ] **Step 3: Remove the de-dupe from `src/lib/m3u.ts`**

Replace the body of `parseM3U` (drop the `seen` set and the comment above it):

```ts
export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXTINF")) continue;

    const url = (lines[i + 1] ?? "").trim();
    if (!url || url.startsWith("#")) continue;

    const name = line.slice(line.lastIndexOf(",") + 1).trim();
    const id = attr(line, "tvg-id") || slug(name);
    if (!id) continue;

    const group = attr(line, "group-title");
    const languages = attr(line, "tvg-language").split(";").filter(Boolean);
    const countries = attr(line, "tvg-country").split(";").filter(Boolean);

    channels.push({
      id,
      name,
      logo: attr(line, "tvg-logo"),
      streamUrls: [url],
      category: toAppCategory(group ? group.split(";") : []),
      languages,
      countries,
      quality: null,
    });
  }
  return channels;
}
```

- [ ] **Step 4: Run the full suite to verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS (the other m3u tests still hold; iptv-org has no dup ids so `source.ts` behaviour is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/m3u.ts __tests__/m3u.test.ts
git commit -m "refactor: parseM3U keeps every entry; merge layer de-dupes"
```

---

### Task 3: Source registry — `sources.ts`

The curated registry + a pure `applyDefaults` that fills source-level metadata onto entries that lack it.

**Files:**
- Create: `src/lib/sources.ts`
- Test: `__tests__/sources.test.ts`

**Interfaces:**
- Consumes: `Channel`, `AppCategory` from `@/lib/types`.
- Produces: `type Source`, `SOURCES: Source[]`, `applyDefaults(channels: Channel[], source: Source): Channel[]`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/sources.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SOURCES, applyDefaults, type Source } from "@/lib/sources";
import type { Channel } from "@/lib/types";

const ch = (o: Partial<Channel>): Channel => ({
  id: "X", name: "X", logo: "", streamUrls: ["https://x"],
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("SOURCES", () => {
  it("lists iptv-org first as the canonical spine", () => {
    expect(SOURCES[0].label).toBe("iptv-org");
    expect(SOURCES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("applyDefaults", () => {
  const src: Source = { label: "t", url: "u", country: "JP", language: "Japanese", category: "News" };

  it("fills country/language/category when the entry lacks them", () => {
    const out = applyDefaults([ch({ countries: [], languages: [], category: "Other" })], src);
    expect(out[0]).toMatchObject({ countries: ["JP"], languages: ["Japanese"], category: "News" });
  });

  it("never overrides values the entry already has", () => {
    const out = applyDefaults(
      [ch({ countries: ["US"], languages: ["English"], category: "Sports" })],
      src,
    );
    expect(out[0]).toMatchObject({ countries: ["US"], languages: ["English"], category: "Sports" });
  });

  it("is a no-op when the source declares no defaults", () => {
    const bare: Source = { label: "b", url: "u" };
    const input = ch({ countries: [], languages: [], category: "Other" });
    expect(applyDefaults([input], bare)[0]).toMatchObject({ countries: [], languages: [], category: "Other" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/sources.test.ts`
Expected: FAIL — `@/lib/sources` does not exist.

- [ ] **Step 3: Implement `src/lib/sources.ts`**

```ts
import type { AppCategory, Channel } from "./types";

export type Source = {
  label: string;            // provenance / logging
  url: string;
  country?: string;         // ISO code applied to entries missing tvg-country
  language?: string;        // applied to entries missing tvg-language
  category?: AppCategory;   // applied when the parsed category is the "Other" fallback
};

// Curated registry, in priority order. iptv-org is the canonical spine (full
// metadata + enrichment). Add more sources by appending here.
export const SOURCES: Source[] = [
  { label: "iptv-org",   url: "https://iptv-org.github.io/iptv/index.m3u" },
  { label: "free-tv",    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },
  { label: "atsushi-jp", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/jp.m3u", country: "JP", language: "Japanese" },
  { label: "atsushi-tv", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/tv.m3u" },
];

// Fill source-level defaults onto entries that lack them (never override real
// parsed values). Applied to each source's channels after parseM3U.
export function applyDefaults(channels: Channel[], source: Source): Channel[] {
  return channels.map((c) => {
    const next: Channel = { ...c };
    if (next.countries.length === 0 && source.country) next.countries = [source.country];
    if (next.languages.length === 0 && source.language) next.languages = [source.language];
    if (next.category === "Other" && source.category) next.category = source.category;
    return next;
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/sources.test.ts && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources.ts __tests__/sources.test.ts
git commit -m "feat: curated source registry + per-source metadata defaults"
```

---

### Task 4: Wire multi-source fetch + merge into `source.ts`

Replace the single-source fetch with a parallel, fault-tolerant multi-source pipeline.

**Files:**
- Modify: `src/lib/source.ts`
- Test: `__tests__/source.test.ts`

**Interfaces:**
- Consumes: `mergeSources` (Task 1), `parseM3U` (Task 2), `SOURCES`/`applyDefaults`/`Source` (Task 3), `applyEnrichment` (existing).
- Produces: `createChannelSource(fetcher?, sources?)` and the `getChannels` singleton (unchanged signatures for callers).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/source.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createChannelSource } from "@/lib/source";
import type { Source } from "@/lib/sources";

const SRC = (label: string, url: string, extra: Partial<Source> = {}): Source => ({ label, url, ...extra });

// Minimal M3U for one channel with a given tvg-id and url.
const m3u = (id: string, url: string, name = id) =>
  `#EXTM3U\n#EXTINF:-1 tvg-id="${id}",${name}\n${url}\n`;

describe("createChannelSource (multi-source)", () => {
  it("merges the same channel across sources into unioned streamUrls", async () => {
    const sources = [SRC("a", "urlA"), SRC("b", "urlB")];
    const fetcher = vi.fn(async (url: string) =>
      url === "urlA" ? m3u("CNN.us", "https://1") : m3u("CNN.us", "https://2"),
    );
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels).toHaveLength(1);
    expect(channels[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("skips a failing source instead of breaking the catalogue", async () => {
    const sources = [SRC("good", "ok"), SRC("bad", "boom")];
    const fetcher = vi.fn(async (url: string) => {
      if (url === "boom") throw new Error("404");
      return m3u("A.us", "https://1");
    });
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("A.us");
  });

  it("throws only when every source fails", async () => {
    const sources = [SRC("a", "x"), SRC("b", "y")];
    const fetcher = vi.fn(async () => { throw new Error("down"); });
    const load = createChannelSource(fetcher, sources);
    await expect(load()).rejects.toThrow(/all playlist sources failed/);
  });

  it("applies per-source metadata defaults", async () => {
    const sources = [SRC("jp", "u", { country: "JP", language: "Japanese" })];
    const fetcher = vi.fn(async () => m3u("somejp", "https://1", "Some JP Channel"));
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels[0]).toMatchObject({ countries: ["JP"], languages: ["Japanese"] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/source.test.ts`
Expected: FAIL — `createChannelSource` doesn't accept a `sources` arg / isn't multi-source yet.

- [ ] **Step 3: Rewrite `src/lib/source.ts`**

```ts
import type { Channel } from "./types";
import { parseM3U } from "./m3u";
import { applyEnrichment, type EnrichmentMap } from "./enrich";
import { mergeSources } from "./merge";
import { SOURCES, applyDefaults, type Source } from "./sources";
import enrichment from "@/data/enrichment.json";

const TTL_MS = 60 * 60 * 1000; // 1 hour

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

// Fetch every source in parallel; a failed source is logged and skipped so one
// bad URL never breaks the catalogue. Parse + apply per-source defaults, merge
// (identity union of streamUrls), then enrich. Cached for an hour.
export function createChannelSource(
  fetcher: Fetcher = defaultFetcher,
  sources: Source[] = SOURCES,
) {
  let cache: { channels: Channel[]; at: number } | null = null;
  return async (): Promise<Channel[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;

    const results = await Promise.allSettled(sources.map((s) => fetcher(s.url)));
    const lists: Channel[][] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        lists.push(applyDefaults(parseM3U(r.value), sources[i]));
      } else {
        console.warn(`[source] ${sources[i].label} failed:`, r.reason);
      }
    });
    if (lists.length === 0) throw new Error("all playlist sources failed");

    const channels = applyEnrichment(mergeSources(lists), enrichment as EnrichmentMap);
    cache = { channels, at: Date.now() };
    return channels;
  };
}

export const getChannels = createChannelSource();
```

- [ ] **Step 4: Run the focused tests, then the full suite + typecheck**

Run: `npx vitest run __tests__/source.test.ts && npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Lint and production build**

Run: `npm run lint && npm run build`
Expected: lint clean except the pre-existing `<img>` warning in `ChannelCard.tsx`; build "Compiled successfully" with all routes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/source.ts __tests__/source.test.ts
git commit -m "feat: multi-source fetch + merge behind /api/channels"
```

---

## Self-Review

**Spec coverage:**
- Source registry → Task 3 (`SOURCES`, `Source`). ✓
- Parser change (no within-source de-dupe) → Task 2. ✓
- Merge + identity (tvg-id/name+country) + within/cross-source URL union + cap → Task 1. ✓
- https upgrade → Task 1 (`httpsUpgrade`, applied in `mergeSources`). ✓
- Per-source metadata defaults → Task 3 (`applyDefaults`), wired in Task 4. ✓
- Fetch resilience (`allSettled`, skip failed, throw if all fail) → Task 4. ✓
- Enrichment after merge (unchanged) → Task 4. ✓
- Adult: no filter (source selection only) → reflected by absence; nothing to implement. ✓
- Mixed content handled via https upgrade → Task 1. ✓

**Placeholder scan:** none — every code/run step is concrete.

**Type consistency:** `httpsUpgrade`/`normalizeName`/`identityKey`/`mergeSources` (Task 1) are imported by Task 4 via `source.ts`; `Source`/`SOURCES`/`applyDefaults` (Task 3) consumed by Task 4; `MAX_SOURCES` from `enrich.ts` used in Task 1; `parseM3U` (Task 2) returns `Channel[]` consumed by Task 4. `createChannelSource(fetcher?, sources?)` keeps the existing `getChannels` singleton working for current callers (`useChannels`, API route).
