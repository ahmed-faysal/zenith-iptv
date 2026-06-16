# Personal Live TV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal live TV web app that streams free iptv-org channels, with a TV-friendly D-pad UI, deployable to Vercel and installable on an LG OLED TV via webOS.

**Architecture:** Next.js (App Router) frontend + serverless API routes. API routes fetch and parse the iptv-org M3U playlist and EPG server-side (bypassing CORS), cache results in memory, and serve clean JSON. The frontend plays HLS streams via `hls.js`, persists favorites/recents/preferences in `localStorage`, and navigates entirely by keyboard/D-pad. No database.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, `hls.js`, Vitest + React Testing Library + jsdom, deployed to Vercel.

---

## File Structure

```
Live TV/
  package.json
  tsconfig.json
  next.config.ts
  vitest.config.ts
  vitest.setup.ts
  .gitignore
  src/
    lib/
      m3u.ts            — M3U playlist parser → Channel[]
      epg.ts            — XMLTV EPG parser → now/next per channel
      categories.ts     — map raw iptv-org groups → app category buckets
      storage.ts        — localStorage helpers (favorites, recents, last, prefs)
      types.ts          — shared TS types (Channel, EpgEntry, Prefs)
    app/
      layout.tsx        — root layout, dark theme
      page.tsx          — Home (rows)
      watch/[id]/page.tsx — Player page
      search/page.tsx   — Search page
      api/
        channels/route.ts — GET /api/channels
        epg/route.ts       — GET /api/epg
    components/
      ChannelCard.tsx
      CategoryRow.tsx
      VideoPlayer.tsx
      QualitySelector.tsx
      Overlay.tsx
      ChannelSidebar.tsx
      SettingsPanel.tsx
    hooks/
      useFocusNav.ts    — D-pad / arrow-key focus navigation
  __tests__/
    m3u.test.ts
    epg.test.ts
    categories.test.ts
    storage.test.ts
    api-channels.test.ts
    ChannelCard.test.tsx
    CategoryRow.test.tsx
    QualitySelector.test.tsx
```

Tasks build bottom-up: types → pure parsers/helpers (fully unit-tested) → API routes → components → pages → TV packaging. Each task is independently committable.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create the Next.js project non-interactively**

Run from inside the `Live TV` directory:
```bash
npx create-next-app@latest . --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*" --use-npm --yes
```
Expected: project files generated into the current directory. If it refuses because the directory is non-empty (the `docs/` folder exists), generate into a temp dir and move files in:
```bash
npx create-next-app@latest _scaffold --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*" --use-npm --yes
cp -R _scaffold/. . && rm -rf _scaffold
```

- [ ] **Step 2: Install test + runtime dependencies**

```bash
npm install hls.js
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: packages added to `package.json`.

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify the toolchain runs**

```bash
npm run test
```
Expected: Vitest runs and reports "No test files found" (exit 0) — confirms config loads.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/types.ts`:
```ts
export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  category: string;
  languages: string[];
  countries: string[];
  nowPlaying?: string;
};

export type EpgProgramme = { title: string; start: string; end: string };

export type EpgEntry = {
  now?: EpgProgramme;
  next?: { title: string; start: string };
};

export type Prefs = {
  languages: string[];
  countries: string[];
};

export type AppCategory =
  | "News" | "Sports" | "Entertainment" | "Music" | "Kids" | "Other";
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: Category mapping

**Files:**
- Create: `src/lib/categories.ts`
- Test: `__tests__/categories.test.ts`

iptv-org tags channels with free-form group titles (e.g. "News;Politics", "Sports", "Kids", "Movies"). We map these to our six buckets.

- [ ] **Step 1: Write the failing test**

Create `__tests__/categories.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toAppCategory } from "@/lib/categories";

describe("toAppCategory", () => {
  it("maps news groups", () => {
    expect(toAppCategory(["News"])).toBe("News");
    expect(toAppCategory(["Politics", "News"])).toBe("News");
  });
  it("maps sports", () => {
    expect(toAppCategory(["Sports"])).toBe("Sports");
  });
  it("maps movies and series to Entertainment", () => {
    expect(toAppCategory(["Movies"])).toBe("Entertainment");
    expect(toAppCategory(["Series"])).toBe("Entertainment");
  });
  it("maps music", () => {
    expect(toAppCategory(["Music"])).toBe("Music");
  });
  it("maps kids", () => {
    expect(toAppCategory(["Kids"])).toBe("Kids");
  });
  it("falls back to Other for unknown or empty", () => {
    expect(toAppCategory(["Weather"])).toBe("Other");
    expect(toAppCategory([])).toBe("Other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- categories`
Expected: FAIL — cannot find module `@/lib/categories`.

- [ ] **Step 3: Implement**

Create `src/lib/categories.ts`:
```ts
import type { AppCategory } from "./types";

const RULES: [AppCategory, string[]][] = [
  ["News", ["news", "politics"]],
  ["Sports", ["sport", "sports"]],
  ["Music", ["music"]],
  ["Kids", ["kids", "children", "cartoon"]],
  ["Entertainment", ["movies", "series", "entertainment", "general", "comedy", "drama"]],
];

export function toAppCategory(groups: string[]): AppCategory {
  const haystack = groups.map((g) => g.toLowerCase());
  for (const [category, keywords] of RULES) {
    if (haystack.some((g) => keywords.some((k) => g.includes(k)))) {
      return category;
    }
  }
  return "Other";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- categories`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts __tests__/categories.test.ts
git commit -m "feat: map iptv-org groups to app categories"
```

---

## Task 4: M3U parser

**Files:**
- Create: `src/lib/m3u.ts`
- Test: `__tests__/m3u.test.ts`

iptv-org `#EXTINF` lines look like:
`#EXTINF:-1 tvg-id="BBCNews.uk" tvg-logo="http://logo.png" group-title="News" tvg-language="English" tvg-country="GB",BBC News`
followed by the stream URL on the next line.

- [ ] **Step 1: Write the failing test**

Create `__tests__/m3u.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseM3U } from "@/lib/m3u";

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="BBCNews.uk" tvg-logo="http://logo/bbc.png" group-title="News" tvg-language="English" tvg-country="GB",BBC News
http://example.com/bbc.m3u8
#EXTINF:-1 tvg-id="ESPN.us" tvg-logo="http://logo/espn.png" group-title="Sports" tvg-language="English" tvg-country="US",ESPN
http://example.com/espn.m3u8
`;

describe("parseM3U", () => {
  it("parses two channels", () => {
    const channels = parseM3U(SAMPLE);
    expect(channels).toHaveLength(2);
  });
  it("extracts name, logo, stream url", () => {
    const [bbc] = parseM3U(SAMPLE);
    expect(bbc.name).toBe("BBC News");
    expect(bbc.logo).toBe("http://logo/bbc.png");
    expect(bbc.streamUrl).toBe("http://example.com/bbc.m3u8");
  });
  it("derives id, category, languages, countries", () => {
    const [bbc] = parseM3U(SAMPLE);
    expect(bbc.id).toBe("BBCNews.uk");
    expect(bbc.category).toBe("News");
    expect(bbc.languages).toEqual(["English"]);
    expect(bbc.countries).toEqual(["GB"]);
  });
  it("skips entries without a stream url", () => {
    const broken = `#EXTM3U\n#EXTINF:-1,No URL Channel\n`;
    expect(parseM3U(broken)).toHaveLength(0);
  });
  it("falls back to a generated id when tvg-id is missing", () => {
    const noId = `#EXTM3U\n#EXTINF:-1 group-title="News",Some Channel\nhttp://x/y.m3u8\n`;
    expect(parseM3U(noId)[0].id).toBe("some-channel");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- m3u`
Expected: FAIL — cannot find module `@/lib/m3u`.

- [ ] **Step 3: Implement**

Create `src/lib/m3u.ts`:
```ts
import type { Channel } from "./types";
import { toAppCategory } from "./categories";

function attr(line: string, key: string): string {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXTINF")) continue;

    const url = (lines[i + 1] ?? "").trim();
    if (!url || url.startsWith("#")) continue;

    const name = line.slice(line.lastIndexOf(",") + 1).trim();
    const group = attr(line, "group-title");
    const languages = attr(line, "tvg-language").split(";").filter(Boolean);
    const countries = attr(line, "tvg-country").split(";").filter(Boolean);
    const tvgId = attr(line, "tvg-id");

    channels.push({
      id: tvgId || slug(name),
      name,
      logo: attr(line, "tvg-logo"),
      streamUrl: url,
      category: toAppCategory(group ? group.split(";") : []),
      languages,
      countries,
    });
  }
  return channels;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- m3u`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/m3u.ts __tests__/m3u.test.ts
git commit -m "feat: parse M3U playlist into channels"
```

---

## Task 5: EPG parser

**Files:**
- Create: `src/lib/epg.ts`
- Test: `__tests__/epg.test.ts`

XMLTV `<programme>` elements carry `start`/`stop` in `YYYYMMDDHHMMSS +0000` format, a `channel` attribute, and a `<title>` child. Given a channel id and "now" time, return the current and next programme.

- [ ] **Step 1: Write the failing test**

Create `__tests__/epg.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEpgForChannel } from "@/lib/epg";

const XML = `<?xml version="1.0"?>
<tv>
  <programme start="20260616080000 +0000" stop="20260616090000 +0000" channel="BBCNews.uk">
    <title>Breakfast</title>
  </programme>
  <programme start="20260616090000 +0000" stop="20260616100000 +0000" channel="BBCNews.uk">
    <title>Morning News</title>
  </programme>
  <programme start="20260616080000 +0000" stop="20260616090000 +0000" channel="ESPN.us">
    <title>SportsCenter</title>
  </programme>
</tv>`;

const NOW = new Date("2026-06-16T08:30:00Z");

describe("parseEpgForChannel", () => {
  it("returns now and next for a channel", () => {
    const entry = parseEpgForChannel(XML, "BBCNews.uk", NOW);
    expect(entry.now?.title).toBe("Breakfast");
    expect(entry.next?.title).toBe("Morning News");
  });
  it("returns empty object for unknown channel", () => {
    const entry = parseEpgForChannel(XML, "Unknown.xx", NOW);
    expect(entry.now).toBeUndefined();
    expect(entry.next).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- epg`
Expected: FAIL — cannot find module `@/lib/epg`.

- [ ] **Step 3: Implement**

Create `src/lib/epg.ts`:
```ts
import type { EpgEntry, EpgProgramme } from "./types";

// "20260616080000 +0000" -> Date
function parseXmltvTime(raw: string): Date {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi, s, tz = "+0000"] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz.slice(0, 3)}:${tz.slice(3)}`;
  return new Date(iso);
}

type Raw = { title: string; start: Date; stop: Date };

function programmesFor(xml: string, channelId: string): Raw[] {
  const out: Raw[] = [];
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const ch = attrs.match(/channel="([^"]*)"/)?.[1];
    if (ch !== channelId) continue;
    const start = attrs.match(/start="([^"]*)"/)?.[1] ?? "";
    const stop = attrs.match(/stop="([^"]*)"/)?.[1] ?? "";
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    out.push({ title, start: parseXmltvTime(start), stop: parseXmltvTime(stop) });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function parseEpgForChannel(xml: string, channelId: string, now: Date): EpgEntry {
  const items = programmesFor(xml, channelId);
  const entry: EpgEntry = {};
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (p.start <= now && now < p.stop) {
      const prog: EpgProgramme = {
        title: p.title,
        start: p.start.toISOString(),
        end: p.stop.toISOString(),
      };
      entry.now = prog;
      if (items[i + 1]) {
        entry.next = { title: items[i + 1].title, start: items[i + 1].start.toISOString() };
      }
      break;
    }
  }
  return entry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- epg`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/epg.ts __tests__/epg.test.ts
git commit -m "feat: parse XMLTV EPG for now/next"
```

---

## Task 6: localStorage helpers

**Files:**
- Create: `src/lib/storage.ts`
- Test: `__tests__/storage.test.ts`

Favorites, recents (capped at 10), last channel, and filter prefs.

- [ ] **Step 1: Write the failing test**

Create `__tests__/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getFavorites, toggleFavorite, isFavorite,
  getRecents, pushRecent,
  getLastChannel, setLastChannel,
  getPrefs, setPrefs,
} from "@/lib/storage";

beforeEach(() => localStorage.clear());

describe("favorites", () => {
  it("toggles on and off", () => {
    expect(isFavorite("a")).toBe(false);
    toggleFavorite("a");
    expect(isFavorite("a")).toBe(true);
    expect(getFavorites()).toEqual(["a"]);
    toggleFavorite("a");
    expect(isFavorite("a")).toBe(false);
  });
});

describe("recents", () => {
  it("keeps most-recent-first and de-dupes", () => {
    pushRecent("a");
    pushRecent("b");
    pushRecent("a");
    expect(getRecents()).toEqual(["a", "b"]);
  });
  it("caps at 10", () => {
    for (let i = 0; i < 15; i++) pushRecent("c" + i);
    expect(getRecents()).toHaveLength(10);
    expect(getRecents()[0]).toBe("c14");
  });
});

describe("last channel + prefs", () => {
  it("round-trips last channel", () => {
    expect(getLastChannel()).toBeNull();
    setLastChannel("x");
    expect(getLastChannel()).toBe("x");
  });
  it("round-trips prefs with defaults", () => {
    expect(getPrefs()).toEqual({ languages: [], countries: [] });
    setPrefs({ languages: ["English"], countries: ["GB"] });
    expect(getPrefs()).toEqual({ languages: ["English"], countries: ["GB"] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- storage`
Expected: FAIL — cannot find module `@/lib/storage`.

- [ ] **Step 3: Implement**

Create `src/lib/storage.ts`:
```ts
import type { Prefs } from "./types";

const KEYS = {
  fav: "ltv.favorites",
  recents: "ltv.recents",
  last: "ltv.lastChannel",
  prefs: "ltv.prefs",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFavorites(): string[] { return read(KEYS.fav, []); }
export function isFavorite(id: string): boolean { return getFavorites().includes(id); }
export function toggleFavorite(id: string): void {
  const cur = getFavorites();
  write(KEYS.fav, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
}

export function getRecents(): string[] { return read(KEYS.recents, []); }
export function pushRecent(id: string): void {
  const next = [id, ...getRecents().filter((x) => x !== id)].slice(0, 10);
  write(KEYS.recents, next);
}

export function getLastChannel(): string | null { return read<string | null>(KEYS.last, null); }
export function setLastChannel(id: string): void { write(KEYS.last, id); }

export function getPrefs(): Prefs { return read(KEYS.prefs, { languages: [], countries: [] }); }
export function setPrefs(p: Prefs): void { write(KEYS.prefs, p); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- storage`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts __tests__/storage.test.ts
git commit -m "feat: localStorage helpers for favorites/recents/prefs"
```

---

## Task 7: `/api/channels` route

**Files:**
- Create: `src/lib/source.ts` (fetch + cache), `src/app/api/channels/route.ts`
- Test: `__tests__/api-channels.test.ts`

Separate the cache/fetch logic (`source.ts`) from the route handler so it is testable without HTTP. This is the abstraction seam noted in the spec for swapping sources later.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api-channels.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChannels, __resetCache } from "@/lib/source";

const M3U = `#EXTM3U
#EXTINF:-1 tvg-id="A.x" group-title="News",A
http://x/a.m3u8
`;

beforeEach(() => __resetCache());

describe("getChannels", () => {
  it("fetches and parses channels", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    const channels = await getChannels(fetcher);
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("A");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("serves from cache on second call", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    await getChannels(fetcher);
    await getChannels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- api-channels`
Expected: FAIL — cannot find module `@/lib/source`.

- [ ] **Step 3: Implement the source/cache layer**

Create `src/lib/source.ts`:
```ts
import type { Channel } from "./types";
import { parseM3U } from "./m3u";

const PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type Cache = { channels: Channel[]; at: number } | null;
let cache: Cache = null;

export function __resetCache(): void { cache = null; }

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlist fetch failed: ${res.status}`);
  return res.text();
};

export async function getChannels(
  fetcher: Fetcher = (url) => defaultFetcher(url)
): Promise<Channel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.channels;
  const text = await fetcher(PLAYLIST_URL);
  const channels = parseM3U(text);
  cache = { channels, at: Date.now() };
  return channels;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- api-channels`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the route handler**

Create `src/app/api/channels/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getChannels } from "@/lib/source";

export async function GET() {
  try {
    const channels = await getChannels();
    return NextResponse.json({ channels });
  } catch (e) {
    return NextResponse.json(
      { channels: [], error: (e as Error).message },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 6: Verify build compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/source.ts src/app/api/channels/route.ts __tests__/api-channels.test.ts
git commit -m "feat: /api/channels with cached iptv-org source"
```

---

## Task 8: `/api/epg` route

**Files:**
- Create: `src/lib/epg-source.ts`, `src/app/api/epg/route.ts`

- [ ] **Step 1: Implement the EPG source/cache layer**

Create `src/lib/epg-source.ts`:
```ts
import { parseEpgForChannel } from "./epg";
import type { EpgEntry } from "./types";

const EPG_URL = "https://iptv-org.github.io/epg/guides/full.xml";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

type Cache = { xml: string; at: number } | null;
let cache: Cache = null;

type Fetcher = (url: string) => Promise<string>;
const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`epg fetch failed: ${res.status}`);
  return res.text();
};

async function getXml(fetcher: Fetcher = defaultFetcher): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.xml;
  const xml = await fetcher(EPG_URL);
  cache = { xml, at: Date.now() };
  return xml;
}

export async function getEpg(channelId: string): Promise<EpgEntry> {
  const xml = await getXml();
  return parseEpgForChannel(xml, channelId, new Date());
}
```

Note: if `full.xml` proves too large in practice, the engineer may switch to a per-channel guide URL; the route contract below does not change.

- [ ] **Step 2: Add the route handler**

Create `src/app/api/epg/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getEpg } from "@/lib/epg-source";

export async function GET(req: Request) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getEpg(channelId));
  } catch {
    return NextResponse.json({}, { status: 200 }); // EPG is best-effort
  }
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/epg-source.ts src/app/api/epg/route.ts
git commit -m "feat: /api/epg best-effort now/next"
```

---

## Task 9: Focus navigation hook

**Files:**
- Create: `src/hooks/useFocusNav.ts`

A roving-focus helper: given a container ref, arrow keys move focus between elements marked `data-focusable`. Used by rows, sidebar, and settings. Kept dependency-free so it works identically with a keyboard and an LG remote (which emits arrow + Enter key events).

- [ ] **Step 1: Implement**

Create `src/hooks/useFocusNav.ts`:
```ts
"use client";
import { useEffect, RefObject } from "react";

type Options = { orientation?: "horizontal" | "vertical" | "grid" };

export function useFocusNav(
  ref: RefObject<HTMLElement | null>,
  { orientation = "horizontal" }: Options = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function items(): HTMLElement[] {
      return Array.from(el!.querySelectorAll<HTMLElement>("[data-focusable]"));
    }

    function onKey(e: KeyboardEvent) {
      const list = items();
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;

      const next = (delta: number) => {
        const t = list[idx + delta];
        if (t) { e.preventDefault(); t.focus(); }
      };

      const horiz = orientation !== "vertical";
      const vert = orientation !== "horizontal";
      if (horiz && e.key === "ArrowRight") next(1);
      if (horiz && e.key === "ArrowLeft") next(-1);
      if (vert && e.key === "ArrowDown") next(1);
      if (vert && e.key === "ArrowUp") next(-1);
    }

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref, orientation]);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFocusNav.ts
git commit -m "feat: roving focus navigation hook"
```

---

## Task 10: ChannelCard component

**Files:**
- Create: `src/components/ChannelCard.tsx`
- Test: `__tests__/ChannelCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/ChannelCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelCard } from "@/components/ChannelCard";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "A.x", name: "Channel A", logo: "http://x/a.png",
  streamUrl: "http://x/a.m3u8", category: "News",
  languages: ["English"], countries: ["GB"], nowPlaying: "Morning News",
};

describe("ChannelCard", () => {
  it("renders name and now-playing", () => {
    render(<ChannelCard channel={ch} onSelect={() => {}} />);
    expect(screen.getByText("Channel A")).toBeInTheDocument();
    expect(screen.getByText("Morning News")).toBeInTheDocument();
  });
  it("calls onSelect when activated with Enter", async () => {
    const onSelect = vi.fn();
    render(<ChannelCard channel={ch} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Channel A/ });
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(ch);
  });
  it("is focusable for D-pad navigation", () => {
    render(<ChannelCard channel={ch} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Channel A/ }))
      .toHaveAttribute("data-focusable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- ChannelCard`
Expected: FAIL — cannot find module `@/components/ChannelCard`.

- [ ] **Step 3: Implement**

Create `src/components/ChannelCard.tsx`:
```tsx
"use client";
import type { Channel } from "@/lib/types";

export function ChannelCard({
  channel, onSelect,
}: { channel: Channel; onSelect: (c: Channel) => void }) {
  return (
    <button
      data-focusable
      onClick={() => onSelect(channel)}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(channel); }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        width: 160, padding: 12, background: "#161616", color: "#eee",
        border: "2px solid transparent", borderRadius: 12, cursor: "pointer",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "#4da3ff")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
    >
      {channel.logo
        ? <img src={channel.logo} alt="" width={96} height={54} style={{ objectFit: "contain" }} />
        : <div style={{ width: 96, height: 54, background: "#333", borderRadius: 6 }} />}
      <span style={{ marginTop: 8, fontWeight: 600, textAlign: "center" }}>{channel.name}</span>
      {channel.nowPlaying && (
        <span style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>{channel.nowPlaying}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- ChannelCard`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChannelCard.tsx __tests__/ChannelCard.test.tsx
git commit -m "feat: ChannelCard component"
```

---

## Task 11: CategoryRow component

**Files:**
- Create: `src/components/CategoryRow.tsx`
- Test: `__tests__/CategoryRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/CategoryRow.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryRow } from "@/components/CategoryRow";
import type { Channel } from "@/lib/types";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrl: "http://x/" + id, category: "News",
  languages: [], countries: [],
});
const channels = [make("a", "Alpha"), make("b", "Bravo"), make("c", "Cara")];

describe("CategoryRow", () => {
  it("renders title and all cards", () => {
    render(<CategoryRow title="News" channels={channels} onSelect={() => {}} />);
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
  it("moves focus right with ArrowRight", async () => {
    render(<CategoryRow title="News" channels={channels} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(buttons[1]).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- CategoryRow`
Expected: FAIL — cannot find module `@/components/CategoryRow`.

- [ ] **Step 3: Implement**

Create `src/components/CategoryRow.tsx`:
```tsx
"use client";
import { useRef } from "react";
import type { Channel } from "@/lib/types";
import { ChannelCard } from "./ChannelCard";
import { useFocusNav } from "@/hooks/useFocusNav";

export function CategoryRow({
  title, channels, onSelect,
}: { title: string; channels: Channel[]; onSelect: (c: Channel) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  if (channels.length === 0) return null;
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: "#eee", margin: "0 0 12px 16px", fontSize: 20 }}>{title}</h2>
      <div
        ref={ref}
        style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px" }}
      >
        {channels.map((c) => (
          <ChannelCard key={c.id} channel={c} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- CategoryRow`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryRow.tsx __tests__/CategoryRow.test.tsx
git commit -m "feat: CategoryRow with horizontal focus nav"
```

---

## Task 12: QualitySelector component

**Files:**
- Create: `src/components/QualitySelector.tsx`
- Test: `__tests__/QualitySelector.test.tsx`

Shows quality options only when the stream has multiple renditions; defaults to Auto; hidden for single-rendition streams.

- [ ] **Step 1: Write the failing test**

Create `__tests__/QualitySelector.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QualitySelector } from "@/components/QualitySelector";

describe("QualitySelector", () => {
  it("renders nothing for a single-level stream", () => {
    const { container } = render(
      <QualitySelector levels={[{ height: 720 }]} current={-1} onSelect={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
  it("renders Auto plus each level when multiple", () => {
    render(
      <QualitySelector
        levels={[{ height: 1080 }, { height: 720 }, { height: 480 }]}
        current={-1}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1080p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "480p" })).toBeInTheDocument();
  });
  it("calls onSelect with the level index", async () => {
    const onSelect = vi.fn();
    render(
      <QualitySelector
        levels={[{ height: 1080 }, { height: 720 }]}
        current={-1}
        onSelect={onSelect}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "720p" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- QualitySelector`
Expected: FAIL — cannot find module `@/components/QualitySelector`.

- [ ] **Step 3: Implement**

Create `src/components/QualitySelector.tsx`:
```tsx
"use client";

export type Level = { height: number };

export function QualitySelector({
  levels, current, onSelect,
}: { levels: Level[]; current: number; onSelect: (levelIndex: number) => void }) {
  if (levels.length <= 1) return null;
  const btn = (active: boolean) => ({
    padding: "4px 10px", borderRadius: 8, cursor: "pointer",
    background: active ? "#4da3ff" : "#222", color: "#fff", border: "none",
  });
  return (
    <div data-focusable style={{ display: "flex", gap: 8 }}>
      <button style={btn(current === -1)} onClick={() => onSelect(-1)}>Auto</button>
      {levels.map((l, i) => (
        <button key={i} style={btn(current === i)} onClick={() => onSelect(i)}>
          {l.height}p
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- QualitySelector`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/QualitySelector.tsx __tests__/QualitySelector.test.tsx
git commit -m "feat: QualitySelector (conditional, Auto default)"
```

---

## Task 13: VideoPlayer component

**Files:**
- Create: `src/components/VideoPlayer.tsx`

`hls.js` touches real media APIs that jsdom does not implement, so this component is verified manually (Task 18) rather than unit-tested. Keep it thin: attach hls.js, surface levels, expose error/loading via callbacks.

- [ ] **Step 1: Implement**

Create `src/components/VideoPlayer.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { QualitySelector, type Level } from "./QualitySelector";

type Status = "loading" | "playing" | "error";

export function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [levels, setLevels] = useState<Level[]>([]);
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("loading");
    setLevels([]);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l) => ({ height: l.height })));
        video.play().then(() => setStatus("playing")).catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStatus("error");
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }

    // Safari / native HLS
    video.src = src;
    video.addEventListener("loadeddata", () => setStatus("playing"));
    video.addEventListener("error", () => setStatus("error"));
    video.play().catch(() => {});
  }, [src]);

  function selectLevel(i: number) {
    setCurrent(i);
    if (hlsRef.current) hlsRef.current.currentLevel = i;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <video ref={videoRef} style={{ width: "100%", height: "100%" }} controls={false} />
      {status === "loading" && <Centered>Loading…</Centered>}
      {status === "error" && <Centered>Stream unavailable — try another channel</Centered>}
      <div style={{ position: "absolute", bottom: 16, right: 16 }}>
        <QualitySelector levels={levels} current={current} onSelect={selectLevel} />
      </div>
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

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoPlayer.tsx
git commit -m "feat: VideoPlayer with hls.js, levels, loading/error states"
```

---

## Task 14: Home page

**Files:**
- Create: `src/app/page.tsx`, `src/components/HomeView.tsx`
- Modify: `src/app/layout.tsx` (dark theme)

`page.tsx` stays a server component shell; `HomeView` is the client component that fetches `/api/channels`, applies prefs, and renders Favorites + Continue-watching + category rows.

- [ ] **Step 1: Set the dark theme in layout**

Replace the `<body>` styling in `src/app/layout.tsx` so the body has `style={{ margin: 0, background: "#0b0b0b", color: "#eee", fontFamily: "system-ui, sans-serif" }}` and set the page `<title>` to "Live TV".

- [ ] **Step 2: Implement HomeView**

Create `src/components/HomeView.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { getFavorites, getRecents, getPrefs, setLastChannel, pushRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];

export function HomeView() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels ?? []))
      .catch(() => setError(true));
  }, []);

  if (error) return <p style={{ padding: 24 }}>Could not load channels. Please retry later.</p>;
  if (!channels) return <p style={{ padding: 24 }}>Loading channels…</p>;

  const prefs = getPrefs();
  const filtered = channels.filter((c) => {
    const langOk = prefs.languages.length === 0 || c.languages.some((l) => prefs.languages.includes(l));
    const ctryOk = prefs.countries.length === 0 || c.countries.some((c2) => prefs.countries.includes(c2));
    return langOk && ctryOk;
  });

  const byId = new Map(filtered.map((c) => [c.id, c]));
  const favorites = getFavorites().map((id) => byId.get(id)).filter(Boolean) as Channel[];
  const recents = getRecents().map((id) => byId.get(id)).filter(Boolean) as Channel[];

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <main style={{ paddingTop: 16 }}>
      <h1 style={{ margin: "0 0 24px 16px" }}>Live TV</h1>
      <CategoryRow title="Favorites" channels={favorites} onSelect={open} />
      <CategoryRow title="Continue Watching" channels={recents} onSelect={open} />
      {ORDER.map((cat) => (
        <CategoryRow
          key={cat}
          title={cat}
          channels={filtered.filter((c) => c.category === cat)}
          onSelect={open}
        />
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Wire the page**

Replace `src/app/page.tsx` contents:
```tsx
import { HomeView } from "@/components/HomeView";
export default function Page() { return <HomeView />; }
```

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --noEmit && npm run build
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/HomeView.tsx
git commit -m "feat: Home page with favorites/recents/category rows"
```

---

## Task 15: Player page + ChannelSidebar

**Files:**
- Create: `src/app/watch/[id]/page.tsx`, `src/components/WatchView.tsx`, `src/components/ChannelSidebar.tsx`

- [ ] **Step 1: Implement ChannelSidebar**

Create `src/components/ChannelSidebar.tsx`:
```tsx
"use client";
import { useRef } from "react";
import type { Channel } from "@/lib/types";
import { useFocusNav } from "@/hooks/useFocusNav";

export function ChannelSidebar({
  channels, open, onSelect,
}: { channels: Channel[]; open: boolean; onSelect: (c: Channel) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "vertical" });
  return (
    <aside
      ref={ref}
      style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: 320,
        background: "rgba(0,0,0,0.85)", transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.2s", overflowY: "auto", padding: 12,
      }}
    >
      {channels.map((c) => (
        <button
          key={c.id}
          data-focusable
          onClick={() => onSelect(c)}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(c); }}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: 12,
            background: "transparent", color: "#eee", border: "none", cursor: "pointer",
          }}
          onFocus={(e) => (e.currentTarget.style.background = "#222")}
          onBlur={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {c.name}
        </button>
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: Implement WatchView**

Create `src/components/WatchView.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, EpgEntry } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { setLastChannel, pushRecent } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [epg, setEpg] = useState<EpgEntry>({});
  const [sidebar, setSidebar] = useState(false);

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => {
      const list: Channel[] = d.channels ?? [];
      setChannels(list);
      setActive(list.find((c) => c.id === channelId) ?? null);
    });
  }, [channelId]);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
    fetch(`/api/epg?channelId=${encodeURIComponent(active.id)}`)
      .then((r) => r.json()).then(setEpg).catch(() => setEpg({}));
  }, [active]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && !sidebar) setSidebar(true);
      if (e.key === "ArrowRight" && sidebar) setSidebar(false);
      if (e.key === "Backspace" || e.key === "Escape") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebar, router]);

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <VideoPlayer src={active.streamUrl} />
      <div style={{ position: "absolute", top: 16, left: 16, color: "#fff" }}>
        <strong>{active.name}</strong>
        {epg.now && <span style={{ marginLeft: 12, opacity: 0.8 }}>{epg.now.title}</span>}
      </div>
      <ChannelSidebar channels={channels} open={sidebar} onSelect={(c) => { setActive(c); setSidebar(false); }} />
    </div>
  );
}
```

- [ ] **Step 3: Wire the page**

Create `src/app/watch/[id]/page.tsx`:
```tsx
import { WatchView } from "@/components/WatchView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WatchView channelId={decodeURIComponent(id)} />;
}
```

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --noEmit && npm run build
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/watch src/components/WatchView.tsx src/components/ChannelSidebar.tsx
git commit -m "feat: Player page with sidebar, EPG overlay, D-pad controls"
```

---

## Task 16: Search page

**Files:**
- Create: `src/app/search/page.tsx`, `src/components/SearchView.tsx`

- [ ] **Step 1: Implement SearchView**

Create `src/components/SearchView.tsx`:
```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { setLastChannel, pushRecent } from "@/lib/storage";

export function SearchView() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => setChannels(d.channels ?? []));
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return channels.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 60);
  }, [q, channels]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <main style={{ padding: 16 }}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search channels…"
        style={{ width: "100%", maxWidth: 480, padding: 12, fontSize: 18, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#eee" }}
      />
      <div style={{ marginTop: 24 }}>
        <CategoryRow title={`Results (${results.length})`} channels={results} onSelect={open} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Wire the page**

Create `src/app/search/page.tsx`:
```tsx
import { SearchView } from "@/components/SearchView";
export default function Page() { return <SearchView />; }
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit && npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/search src/components/SearchView.tsx
git commit -m "feat: search page"
```

---

## Task 17: SettingsPanel (language/country filter)

**Files:**
- Create: `src/components/SettingsPanel.tsx`
- Modify: `src/components/HomeView.tsx` (add a Settings toggle that re-reads prefs)

- [ ] **Step 1: Implement SettingsPanel**

Create `src/components/SettingsPanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import { getPrefs, setPrefs } from "@/lib/storage";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [langs, setLangs] = useState(getPrefs().languages.join(", "));
  const [ctry, setCtry] = useState(getPrefs().countries.join(", "));

  function save() {
    setPrefs({
      languages: langs.split(",").map((s) => s.trim()).filter(Boolean),
      countries: ctry.split(",").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  }

  const field = { width: "100%", padding: 10, marginTop: 6, marginBottom: 16, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#eee" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", padding: 24, borderRadius: 12, width: 360 }}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        <label>Languages (comma-separated)
          <input style={field} value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="English, Spanish" />
        </label>
        <label>Countries (comma-separated codes)
          <input style={field} value={ctry} onChange={(e) => setCtry(e.target.value)} placeholder="GB, US" />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button>
          <button onClick={save} style={{ padding: "8px 16px", background: "#4da3ff", color: "#fff", border: "none", borderRadius: 8 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the toggle to HomeView**

In `src/components/HomeView.tsx`: import `SettingsPanel` and `useState`; add `const [showSettings, setShowSettings] = useState(false);`. Add a gear button near the `<h1>`:
```tsx
<button onClick={() => setShowSettings(true)} style={{ marginLeft: 16 }}>⚙ Settings</button>
{showSettings && <SettingsPanel onClose={() => { setShowSettings(false); router.refresh(); }} />}
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit && npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.tsx src/components/HomeView.tsx
git commit -m "feat: settings panel for language/country filter"
```

---

## Task 18: Manual end-to-end verification

**Files:** none (manual)

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```
Open `http://localhost:3000`.

- [ ] **Step 2: Verify the checklist**

- Home loads with category rows populated from the live iptv-org playlist
- Arrow keys move focus within and between rows; Enter opens a channel
- A channel plays in the browser (allow 15–45s HLS latency)
- Quality selector appears only on multi-rendition streams; Auto is default
- A deliberately dead stream shows "Stream unavailable" rather than hanging
- Left arrow opens the sidebar; selecting a channel switches the stream; Backspace returns Home
- Favoriting (if a star control was added) and recents show their rows on return Home
- Settings filter narrows channels by language/country and persists on reload
- `/search` filters by name and opens a result

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in manual verification"
```

---

## Task 19: Vercel deployment + webOS wrapper

**Files:**
- Create: `webos/appinfo.json`, `webos/README.md`

- [ ] **Step 1: Deploy to Vercel**

```bash
npx vercel --prod
```
Follow prompts (link/create project). Note the production URL.

- [ ] **Step 2: Create the webOS hosted-app descriptor**

Create `webos/appinfo.json` (replace the URL with your Vercel production URL):
```json
{
  "id": "com.personal.livetv",
  "version": "1.0.0",
  "vendor": "Personal",
  "type": "web",
  "main": "https://YOUR-PROJECT.vercel.app",
  "title": "Live TV",
  "icon": "icon.png",
  "largeIcon": "largeIcon.png",
  "bgColor": "#0b0b0b",
  "disableBackHistoryAPI": false
}
```

- [ ] **Step 3: Document packaging steps**

Create `webos/README.md` describing: install `@webos-tools/cli`, drop placeholder `icon.png` (80×80) and `largeIcon.png` (130×130), run `ares-package webos/`, then `ares-install <ipk>` to the TV (or install the `.ipk` via the Homebrew Channel). Note that the real app icon (Task in future considerations) replaces the placeholders later.

- [ ] **Step 4: Commit**

```bash
git add webos/
git commit -m "chore: webOS hosted-app wrapper + deploy notes"
```

---

## Self-Review Notes

- **Spec coverage:** content source (Tasks 4,7,8) · categories (3) · M3U/EPG parse (4,5) · caching API (7,8) · Home with favorites/recents/continue (14) · player + quality selector + dead-stream + sidebar (12,13,15) · search (16) · settings filter (17) · localStorage state (6) · D-pad nav (9, used in 11,15) · latency acknowledged (manual 18) · LG webOS packaging (19) · optional auth deferred (noted; not built — matches "optional"). App icon remains a future improvement per spec.
- **Type consistency:** `Channel`, `EpgEntry`, `Prefs`, `AppCategory`, `Level` defined once and reused; storage function names match between Task 6 and consumers.
- **No placeholders:** every code step contains complete code; the only intentionally manual items are hls.js playback (jsdom limitation) and the webOS device install.
