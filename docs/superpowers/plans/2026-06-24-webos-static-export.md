# webOS Static Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Zenith IPTV app from a Vercel-hosted web app to a self-contained webOS `.ipk` package that plays streams directly from the TV (home IP, no CORS restrictions on `<video>`) while continuing to call Vercel APIs for channel/EPG data.

**Architecture:** The Next.js app is built as a static HTML/JS/CSS export (`output: 'export'`) for packaging into the LG webOS `.ipk`. A build script temporarily removes the proxy route (incompatible with static export and unused in the packaged app), builds the static output, then copies it into the `webos/` package directory. The packaged app calls `https://zenith-iptv.vercel.app` for channel/EPG data (via `NEXT_PUBLIC_API_BASE`), so Vercel continues doing all the heavy M3U parsing and XMLTV processing. The website on Vercel is completely unchanged in behaviour — only two API routes get CORS headers added, and two dynamic URL segments become query params (which Vercel handles fine).

**Tech Stack:** Next.js 15 App Router, Vitest + Testing Library, webOS SDK (`ares-package`, `ares-install`), Bash build script.

## Global Constraints

- Test runner: `npm test` (Vitest). All 214 existing tests must pass at every commit.
- No new npm dependencies.
- Do not modify any component files outside those listed per task.
- `NEXT_PUBLIC_API_BASE` must default to `""` (empty string) so relative paths work on Vercel with no env change.
- `NEXT_PUBLIC_STREAM_PROXY_ENABLED` is already checked in `WatchView.tsx` — do not change that logic.
- The Vercel deployment must continue working identically after every task.
- `webos/appinfo.json` `"main"` changes from the Vercel URL to `"index.html"` — this only affects the packaged app.
- Commit after every task.

---

### Task 1: Add CORS headers to /api/channels and /api/epg

The packaged webOS app (served from `file://`) calls Vercel APIs cross-origin. Without `Access-Control-Allow-Origin: *`, the browser CORS check blocks the fetch. The proxy route is intentionally excluded — the packaged app never calls it.

**Files:**
- Modify: `src/app/api/channels/route.ts`
- Modify: `src/app/api/epg/route.ts`
- Create: `__tests__/api-cors.test.ts`

**Interfaces:**
- Produces: Both GET handlers return a `NextResponse` with `Access-Control-Allow-Origin: *` header alongside all existing JSON fields.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api-cors.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { GET as channelsGET } from "@/app/api/channels/route";
import { GET as epgGET } from "@/app/api/epg/route";

vi.mock("@/lib/source", () => ({
  getChannels: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/epg-source", () => ({
  getGuide: vi.fn().mockResolvedValue(new Map()),
}));

describe("API CORS headers", () => {
  it("/api/channels returns Access-Control-Allow-Origin: *", async () => {
    const res = await channelsGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("/api/epg returns Access-Control-Allow-Origin: *", async () => {
    const res = await epgGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/faysal/Documents/AI Projects/Live TV"
npm test -- api-cors
```

Expected: 2 tests fail — headers are `null`.

- [ ] **Step 3: Add CORS header to /api/channels**

Replace `src/app/api/channels/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getChannels } from "@/lib/source";

export async function GET() {
  try {
    const channels = await getChannels();
    return NextResponse.json({ channels }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return NextResponse.json(
      { channels: [], error: (e as Error).message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
```

- [ ] **Step 4: Add CORS header to /api/epg**

Replace `src/app/api/epg/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getGuide } from "@/lib/epg-source";
import { nowNext, type NowNext } from "@/lib/epg";

export async function GET() {
  try {
    const guide = await getGuide();
    const at = Date.now();
    const out: Record<string, NowNext> = {};
    for (const [id, programmes] of guide) {
      const nn = nowNext(programmes, at);
      if (nn.now || nn.next) out[id] = nn;
    }
    return NextResponse.json({ epg: out }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return NextResponse.json(
      { epg: {}, error: (e as Error).message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: 216 passed (2 new + 214 existing).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/channels/route.ts src/app/api/epg/route.ts __tests__/api-cors.test.ts
git commit -m "feat: add CORS headers to channels and epg API routes"
```

---

### Task 2: Configurable API base URL

The packaged webOS app is built with `NEXT_PUBLIC_API_BASE=https://zenith-iptv.vercel.app` so it calls the Vercel APIs for data. On Vercel (no env var set), the default empty string keeps relative `/api/...` paths, which is unchanged behaviour.

**Files:**
- Modify: `src/lib/channels-client.ts`
- Modify: `src/hooks/useEpg.ts`
- Create: `__tests__/api-base-url.test.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_API_BASE` — string or undefined
- Produces: `loadChannels()` calls `${NEXT_PUBLIC_API_BASE}/api/channels`; `useEpg` calls `${NEXT_PUBLIC_API_BASE}/api/epg`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api-base-url.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("NEXT_PUBLIC_API_BASE prefix", () => {
  beforeEach(() => { vi.unstubAllEnvs(); });

  it("channels defaultFetcher prepends NEXT_PUBLIC_API_BASE when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "https://example.com");
    // Re-import so the module picks up the new env value
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: [] })),
    );
    const { loadChannels } = await import("@/lib/channels-client");
    await loadChannels();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/api/channels"),
    );
    fetchSpy.mockRestore();
  });

  it("channels defaultFetcher uses relative path when NEXT_PUBLIC_API_BASE is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: [] })),
    );
    const { loadChannels } = await import("@/lib/channels-client");
    await loadChannels();
    expect(fetchSpy).toHaveBeenCalledWith("/api/channels");
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- api-base-url
```

Expected: 2 tests fail — fetch is called with `/api/channels` regardless of env var.

- [ ] **Step 3: Update channels-client.ts**

Replace `src/lib/channels-client.ts` with:

```ts
import type { Channel } from "./types";

export type ChannelsFetcher = () => Promise<Channel[]>;

const defaultFetcher: ChannelsFetcher = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return fetch(`${base}/api/channels`).then((r) => r.json()).then((d) => d.channels ?? []);
};

// Session-wide cache: the ~2.67 MB channel list is fetched once and shared
// across Home / Watch / Search instead of being re-downloaded per navigation.
// A factory so tests get an isolated cache without a production reset hook.
export function createChannelLoader(fetcher: ChannelsFetcher = defaultFetcher) {
  let cache: Promise<Channel[]> | null = null;
  return (): Promise<Channel[]> => {
    if (!cache) {
      cache = fetcher().catch((err) => {
        cache = null;
        throw err;
      });
    }
    return cache;
  };
}

export const loadChannels = createChannelLoader();
```

- [ ] **Step 4: Update useEpg.ts**

Replace `src/hooks/useEpg.ts` with:

```ts
"use client";
import { useEffect, useState } from "react";
import type { NowNext } from "@/lib/epg";

export type EpgMap = Record<string, NowNext>;

export function useEpg(refreshMs = 5 * 60 * 1000): EpgMap {
  const [epg, setEpg] = useState<EpgMap>({});

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
    let alive = true;
    const load = () =>
      fetch(`${base}/api/epg`)
        .then((r) => r.json())
        .then((d) => { if (alive) setEpg(d.epg ?? {}); })
        .catch(() => {});
    load();
    const id = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [refreshMs]);

  return epg;
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: 218 passed (2 new + 216 from Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/lib/channels-client.ts src/hooks/useEpg.ts __tests__/api-base-url.test.ts
git commit -m "feat: support NEXT_PUBLIC_API_BASE for webOS packaged app API calls"
```

---

### Task 3: Migrate /watch/[id] route to /watch?id= query param

Static export cannot pre-generate pages for 13,286 channel IDs. Converting to a query param produces a single `out/watch/index.html` that reads `?id=` client-side. On Vercel, `/watch?id=CNN.us@HD` still hits the same `watch/page.tsx` — no behaviour change.

**Files:**
- Delete: `src/app/watch/[id]/page.tsx`
- Create: `src/app/watch/page.tsx`
- Modify: `src/components/BrowseView.tsx` (line 64)
- Modify: `src/components/SearchView.tsx` (line 56)
- Create: `__tests__/watch-navigation.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams().get("id")` — URL-encoded channel ID string
- Produces: `<WatchView channelId={decodeURIComponent(id)} />` — same interface as before

- [ ] **Step 1: Write the failing tests**

Create `__tests__/watch-navigation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";
import { SearchView } from "@/components/SearchView";
import type { Channel } from "@/lib/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const ch: Channel = {
  id: "CNN.us@HD", name: "CNN", logo: "",
  streamUrls: ["http://x/cnn"], category: "News",
  languages: ["English"], countries: ["US"],
};

vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({ channels: [ch], error: false }),
}));
vi.mock("@/hooks/useEpg", () => ({ useEpg: () => ({}) }));
vi.mock("@/lib/storage", () => ({
  getFavorites: () => [],
  getRecents: () => [],
  getPrefs: () => ({ languages: [], countries: [] }),
  setLastChannel: vi.fn(),
  pushRecent: vi.fn(),
  removeRecent: vi.fn(),
}));

beforeEach(() => { push.mockClear(); });

describe("watch navigation uses query param", () => {
  it("BrowseView open() pushes /watch?id=", async () => {
    render(<BrowseView />);
    const card = await screen.findByText("CNN");
    await userEvent.click(card);
    expect(push).toHaveBeenCalledWith(
      `/watch?id=${encodeURIComponent("CNN.us@HD")}`,
    );
  });

  it("SearchView open() pushes /watch?id=", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "CNN");
    const card = await screen.findByText("CNN");
    await userEvent.click(card);
    expect(push).toHaveBeenCalledWith(
      `/watch?id=${encodeURIComponent("CNN.us@HD")}`,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- watch-navigation
```

Expected: 2 tests fail — `push` is called with `/watch/CNN.us%40HD` (path segment) instead of `/watch?id=CNN.us%40HD`.

- [ ] **Step 3: Create src/app/watch/page.tsx**

Delete `src/app/watch/[id]/page.tsx` first:

```bash
rm "src/app/watch/[id]/page.tsx"
rmdir "src/app/watch/[id]"
```

Create `src/app/watch/page.tsx`:

```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WatchView } from "@/components/WatchView";

function Watch() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  return <WatchView channelId={decodeURIComponent(id)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Watch />
    </Suspense>
  );
}
```

- [ ] **Step 4: Update BrowseView.tsx open() — line 64**

In `src/components/BrowseView.tsx`, change:

```ts
// Before (line 64)
router.push(`/watch/${encodeURIComponent(c.id)}`);
```

To:

```ts
router.push(`/watch?id=${encodeURIComponent(c.id)}`);
```

- [ ] **Step 5: Update SearchView.tsx open() — line 56**

In `src/components/SearchView.tsx`, change:

```ts
// Before (line 56)
router.push(`/watch/${encodeURIComponent(c.id)}`);
```

To:

```ts
router.push(`/watch?id=${encodeURIComponent(c.id)}`);
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: 220 passed (2 new + 218 from Tasks 1–2).

- [ ] **Step 7: Commit**

```bash
git add src/app/watch/page.tsx src/components/BrowseView.tsx src/components/SearchView.tsx __tests__/watch-navigation.test.tsx
git commit -m "feat: migrate /watch/[id] to /watch?id= for static export compatibility"
```

---

### Task 4: Migrate /category/[slug] route to /category?slug= query param

Same reasoning as Task 3: static export can't pre-generate 6 category pages from a dynamic segment, but a single `/category?slug=news` page works. `BrowseView` receives the category string via `useSearchParams` rather than a route param.

**Files:**
- Delete: `src/app/category/[slug]/page.tsx`
- Create: `src/app/category/page.tsx`
- Modify: `src/components/BrowseView.tsx` (line 73)
- Create: `__tests__/category-navigation.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams().get("slug")` — lowercase category string (e.g. `"news"`)
- Produces: `<BrowseView category="News" />` — same interface as before

- [ ] **Step 1: Write the failing test**

Create `__tests__/category-navigation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({
    channels: [
      { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["http://x/cnn"],
        category: "News", languages: [], countries: [] },
    ],
    error: false,
  }),
}));
vi.mock("@/hooks/useEpg", () => ({ useEpg: () => ({}) }));
vi.mock("@/lib/storage", () => ({
  getFavorites: () => [],
  getRecents: () => [],
  getPrefs: () => ({ languages: [], countries: [] }),
  setLastChannel: vi.fn(),
  pushRecent: vi.fn(),
  removeRecent: vi.fn(),
}));

beforeEach(() => { push.mockClear(); });

describe("category navigation uses query param", () => {
  it("BrowseView goToCategory() pushes /category?slug=", async () => {
    render(<BrowseView />);
    // TopBar renders category tabs; click "News"
    const tab = await screen.findByRole("button", { name: "News" });
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/category?slug=news");
  });

  it("goToCategory('All') still pushes /", async () => {
    render(<BrowseView />);
    const tab = await screen.findByRole("button", { name: "All" });
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- category-navigation
```

Expected: 2 tests fail — `push` is called with `/category/news` instead of `/category?slug=news`.

- [ ] **Step 3: Create src/app/category/page.tsx**

Delete old route:

```bash
rm "src/app/category/[slug]/page.tsx"
rmdir "src/app/category/[slug]"
```

Create `src/app/category/page.tsx`:

```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import type { AppCategory } from "@/lib/types";

const VALID: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];

function Category() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const cat = VALID.find((c) => c.toLowerCase() === slug.toLowerCase());
  if (!cat) return null;
  return <BrowseView category={cat} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Category />
    </Suspense>
  );
}
```

- [ ] **Step 4: Update BrowseView.tsx goToCategory() — line 73**

In `src/components/BrowseView.tsx`, change:

```ts
// Before (line 73)
router.push(cat === "All" ? "/" : `/category/${cat.toLowerCase()}`);
```

To:

```ts
router.push(cat === "All" ? "/" : `/category?slug=${cat.toLowerCase()}`);
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: 222 passed (2 new + 220 from Tasks 1–3).

- [ ] **Step 6: Commit**

```bash
git add src/app/category/page.tsx src/components/BrowseView.tsx __tests__/category-navigation.test.tsx
git commit -m "feat: migrate /category/[slug] to /category?slug= for static export compatibility"
```

---

### Task 5: Static export config + webOS build script

Wire up `output: 'export'` (env-gated so Vercel is unaffected), update `webos/appinfo.json` to load `index.html` from the package instead of the Vercel URL, and write a build script that produces the `.ipk`-ready directory.

The proxy route (`src/app/api/proxy/route.ts`) uses `req: NextRequest`, which Next.js marks as dynamic — incompatible with static export. Since `NEXT_PUBLIC_STREAM_PROXY_ENABLED=0` in webOS builds the packaged app never calls it, the build script temporarily moves the file out of the source tree before building, then restores it.

**Files:**
- Modify: `next.config.ts`
- Modify: `webos/appinfo.json`
- Create: `scripts/build-webos.sh`

**Interfaces:**
- Produces: `out/` — Next.js static export. `webos/` — ready to pass to `ares-package`. Running `ares-package webos/ --outdir .` produces `com.faystech.zenith_1.0.0_all.ipk`.

- [ ] **Step 1: Update next.config.ts**

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.WEBOS_BUILD === "1" && { output: "export" }),
};

export default nextConfig;
```

- [ ] **Step 2: Update webos/appinfo.json**

Replace `webos/appinfo.json` with:

```json
{
  "id": "com.faystech.zenith",
  "version": "1.0.0",
  "vendor": "Fays Tech",
  "type": "web",
  "main": "index.html",
  "title": "Zenith",
  "icon": "icon.png",
  "largeIcon": "largeIcon.png",
  "bgColor": "#0b0b0b",
  "disableBackHistoryAPI": false
}
```

- [ ] **Step 3: Create scripts/build-webos.sh**

```bash
mkdir -p scripts
```

Create `scripts/build-webos.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# The proxy route uses NextRequest — detected as dynamic by Next.js and
# incompatible with static export. The webOS app never calls it
# (NEXT_PUBLIC_STREAM_PROXY_ENABLED=0), so we move it out during the build.
PROXY_ROUTE="src/app/api/proxy/route.ts"
PROXY_BACKUP="$(mktemp /tmp/zenith-proxy-route.XXXXXX)"
mv "$PROXY_ROUTE" "$PROXY_BACKUP"
cleanup() { mv "$PROXY_BACKUP" "$PROXY_ROUTE"; }
trap cleanup EXIT

WEBOS_BUILD=1 \
  NEXT_PUBLIC_API_BASE=https://zenith-iptv.vercel.app \
  NEXT_PUBLIC_STREAM_PROXY_ENABLED=0 \
  npx next build

# Copy the static export into the webOS package directory.
# appinfo.json, icon.png, and largeIcon.png already live in webos/
# and are not produced by next build — they won't be overwritten.
cp -r out/. webos/

echo ""
echo "✓ Static export copied to webos/"
echo ""
echo "Next steps:"
echo "  Package:  ares-package webos/ --outdir ."
echo "  Install:  ares-install com.faystech.zenith_1.0.0_all.ipk"
echo "  Launch:   ares-launch com.faystech.zenith"
```

- [ ] **Step 4: Make the script executable**

```bash
chmod +x scripts/build-webos.sh
```

- [ ] **Step 5: Run all unit tests (proxy route still present)**

```bash
npm test
```

Expected: 222 passed — no regressions.

- [ ] **Step 6: Run the webOS build to verify it works**

```bash
bash scripts/build-webos.sh
```

Expected output ends with:
```
✓ Static export copied to webos/

Next steps:
  Package:  ares-package webos/ --outdir .
  Install:  ares-install com.faystech.zenith_1.0.0_all.ipk
  Launch:   ares-launch com.faystech.zenith
```

Verify the output directory structure:
```bash
ls out/
# Expected: _next  index.html  search  watch  category
ls webos/
# Expected: _next  appinfo.json  category  icon.png  index.html  largeIcon.png  search  watch
```

- [ ] **Step 7: Commit**

```bash
git add next.config.ts webos/appinfo.json scripts/build-webos.sh
git commit -m "feat: add webOS static export build — packaged .ipk with direct stream playback"
```
