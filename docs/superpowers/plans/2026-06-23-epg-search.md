# EPG Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing channel-name search to also show a second "On now · Next" section of channels whose current or upcoming EPG programme title matches the query.

**Architecture:** Pure client-side extension of `SearchView`. Add `searchProgrammes` to `src/lib/search.ts`, a `subtitle` prop to `ChannelCard`, a `subtitleFor` pass-through on `CategoryRow`, and wire `useEpg` + the two result sets in `SearchView`. No new routes, hooks, or pages.

**Tech Stack:** React 19, Next.js 16, TypeScript, Vitest + Testing Library, existing `useEpg` hook.

## Global Constraints

- TypeScript strict mode — no `any`, no type assertions unless unavoidable.
- No new dependencies.
- All new logic unit-tested with Vitest; component changes covered by Testing Library.
- Test runner: `npm test` (Vitest). Run after every task; all 199+ existing tests must stay green.
- Follow existing code style: named exports, no default exports, no comments unless the WHY is non-obvious.
- Do NOT add emoji to UI strings (existing ones like `🔍` may stay).

---

## File Map

| File | Change |
|------|--------|
| `src/lib/search.ts` | Add `EpgResult` type + `searchProgrammes` function |
| `src/components/ChannelCard.tsx` | Add optional `subtitle?: string` prop |
| `src/app/globals.css` | Add `.channel-card__subtitle` style |
| `src/components/CategoryRow.tsx` | Add optional `subtitleFor?: (c: Channel) => string \| undefined` prop |
| `src/components/SearchView.tsx` | Wire `useEpg`, compute EPG results, render second section |
| `__tests__/search.test.ts` | Extend with `searchProgrammes` tests |
| `__tests__/ChannelCard.test.tsx` | Add subtitle render test |
| `__tests__/CategoryRow.test.tsx` | Add `subtitleFor` pass-through test |

---

## Task 1: `searchProgrammes` in `src/lib/search.ts`

**Files:**
- Modify: `src/lib/search.ts`
- Test: `__tests__/search.test.ts`

**Interfaces:**
- Consumes: `EpgMap` from `@/hooks/useEpg`, `baseChannelId` from `@/lib/epg`, `Channel` from `@/lib/types`
- Produces:
  ```ts
  export type EpgResult = { channel: Channel; subtitle: string };

  export function searchProgrammes(
    epgMap: EpgMap,
    channels: Channel[],
    query: string,
    exclude: Set<string>,
    limit?: number,   // default 30
  ): EpgResult[]
  ```

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/search.test.ts` (keep existing `make` helper + `list` fixture, add new ones below):

```ts
import { searchProgrammes } from "@/lib/search";
import type { EpgMap } from "@/hooks/useEpg";

// Reuse existing `make` helper (already in the file).
// Build a minimal EpgMap keyed by base channel id (no "@feed" suffix).
const epgMap: EpgMap = {
  "a": { now: { channel: "a", start: 0, stop: 9999999999999, title: "World Cup Final" } },
  "b": { next: { channel: "b", start: 9999999999999, stop: 9999999999999 + 3600000, title: "F1 Race Highlights" } },
  "c": { now: { channel: "c", start: 0, stop: 9999999999999, title: "World Cup Draw" }, next: { channel: "c", start: 9999999999999, stop: 9999999999999 + 3600000, title: "Match Preview" } },
  "d": {},
};

describe("searchProgrammes", () => {
  it("returns empty list for blank query", () => {
    expect(searchProgrammes(epgMap, list, "", new Set())).toEqual([]);
    expect(searchProgrammes(epgMap, list, "   ", new Set())).toEqual([]);
  });

  it("matches now.title case-insensitively", () => {
    const r = searchProgrammes(epgMap, list, "world cup", new Set());
    expect(r.map((x) => x.channel.id)).toContain("a");
    expect(r.find((x) => x.channel.id === "a")?.subtitle).toBe("Now · World Cup Final");
  });

  it("matches next.title when now does not match", () => {
    const r = searchProgrammes(epgMap, list, "f1", new Set());
    expect(r.map((x) => x.channel.id)).toContain("b");
    expect(r.find((x) => x.channel.id === "b")?.subtitle).toBe("Next · F1 Race Highlights");
  });

  it("prefers now over next when both match", () => {
    // channel "c" has now="World Cup Draw" and next="Match Preview"; "world cup" matches now
    const r = searchProgrammes(epgMap, list, "world cup", new Set());
    expect(r.find((x) => x.channel.id === "c")?.subtitle).toBe("Now · World Cup Draw");
  });

  it("excludes channel ids in the exclude set", () => {
    const r = searchProgrammes(epgMap, list, "world cup", new Set(["a", "c"]));
    expect(r.map((x) => x.channel.id)).not.toContain("a");
    expect(r.map((x) => x.channel.id)).not.toContain("c");
  });

  it("skips channels with no EPG entry silently", () => {
    // channel "d" has an empty EPG entry; should not appear for any query
    const r = searchProgrammes(epgMap, list, "al jazeera", new Set());
    expect(r.map((x) => x.channel.id)).not.toContain("d");
  });

  it("caps results at the given limit", () => {
    const bigEpg: EpgMap = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [
        "n" + i,
        { now: { channel: "n" + i, start: 0, stop: 9999999999999, title: "News Live" } },
      ])
    );
    const bigList = Array.from({ length: 50 }, (_, i) => make("n" + i, "Channel " + i));
    expect(searchProgrammes(bigEpg, bigList, "news", new Set(), 10)).toHaveLength(10);
  });

  it("matches mixed-case query", () => {
    const r = searchProgrammes(epgMap, list, "WORLD CUP", new Set());
    expect(r.map((x) => x.channel.id)).toContain("a");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/search.test.ts
```

Expected: multiple failures — `searchProgrammes is not a function` / import error.

- [ ] **Step 3: Implement `searchProgrammes`**

Full updated `src/lib/search.ts`:

```ts
import type { Channel } from "./types";
import type { EpgMap } from "@/hooks/useEpg";
import { baseChannelId } from "@/lib/epg";

export function searchChannels(channels: Channel[], query: string, limit = 60): Channel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return channels
    .filter((c) => c.name.toLowerCase().includes(needle))
    .slice(0, limit);
}

export type EpgResult = { channel: Channel; subtitle: string };

export function searchProgrammes(
  epgMap: EpgMap,
  channels: Channel[],
  query: string,
  exclude: Set<string>,
  limit = 30,
): EpgResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const out: EpgResult[] = [];
  for (const c of channels) {
    if (out.length >= limit) break;
    if (exclude.has(c.id)) continue;
    const entry = epgMap[baseChannelId(c.id)];
    if (!entry) continue;
    if (entry.now?.title.toLowerCase().includes(needle)) {
      out.push({ channel: c, subtitle: `Now · ${entry.now.title}` });
    } else if (entry.next?.title.toLowerCase().includes(needle)) {
      out.push({ channel: c, subtitle: `Next · ${entry.next.title}` });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/search.test.ts
```

Expected: all `searchProgrammes` tests pass + existing `searchChannels` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts __tests__/search.test.ts
git commit -m "feat: add searchProgrammes for EPG title search"
```

---

## Task 2: `ChannelCard` subtitle prop + CSS

**Files:**
- Modify: `src/components/ChannelCard.tsx`
- Modify: `src/app/globals.css`
- Test: `__tests__/ChannelCard.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `ChannelCard` now accepts optional `subtitle?: string`; renders `<span className="channel-card__subtitle">{subtitle}</span>` when present

- [ ] **Step 1: Write the failing test**

Add to `__tests__/ChannelCard.test.tsx` inside the existing `describe("ChannelCard", ...)` block:

```ts
it("renders the subtitle when provided", () => {
  render(<ChannelCard channel={ch} onSelect={() => {}} subtitle="Now · Match of the Day" />);
  expect(screen.getByText("Now · Match of the Day")).toBeInTheDocument();
});

it("renders nothing extra when subtitle is omitted", () => {
  const { container } = render(<ChannelCard channel={ch} onSelect={() => {}} />);
  expect(container.querySelector(".channel-card__subtitle")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/ChannelCard.test.tsx
```

Expected: the two new tests fail (subtitle prop not accepted / element not found).

- [ ] **Step 3: Add `subtitle` prop to `ChannelCard`**

In `src/components/ChannelCard.tsx`, update the props destructuring and JSX:

```tsx
export function ChannelCard({
  channel, onSelect, subtitle,
}: { channel: Channel; onSelect: (c: Channel) => void; subtitle?: string }) {
```

And after `<span className="channel-card__title">{title}</span>`, add:

```tsx
{subtitle && (
  <span className="channel-card__subtitle">{subtitle}</span>
)}
```

The full return block should look like:

```tsx
return (
  <button
    className="channel-card"
    data-focusable
    onClick={() => onSelect(channel)}
    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelect(channel); } }}
  >
    <span className="channel-card__plate">
      {channel.logo && !broken ? (
        <img
          src={channel.logo}
          alt=""
          loading="lazy"
          className="channel-card__logo"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="channel-card__fallback" aria-hidden>
          {title.slice(0, 2).toUpperCase()}
        </span>
      )}
      {quality && (
        <span className={`channel-card__quality${isHd(quality) ? " is-hd" : ""}`}>
          {isHd(quality) ? "HD" : quality}
        </span>
      )}
    </span>
    <span className="channel-card__title">{title}</span>
    {subtitle && (
      <span className="channel-card__subtitle">{subtitle}</span>
    )}
    {flags.length > 0 && (
      <span className="channel-card__flags">{flags.join(" · ")}</span>
    )}
  </button>
);
```

- [ ] **Step 4: Add CSS for `.channel-card__subtitle`**

In `src/app/globals.css`, add directly after the `.channel-card__flags` block (around line 171):

```css
.channel-card__subtitle {
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- __tests__/ChannelCard.test.tsx
```

Expected: all 7 tests pass (5 existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/ChannelCard.tsx src/app/globals.css __tests__/ChannelCard.test.tsx
git commit -m "feat: add subtitle prop to ChannelCard for EPG programme label"
```

---

## Task 3: `CategoryRow` — `subtitleFor` prop

**Files:**
- Modify: `src/components/CategoryRow.tsx`
- Test: `__tests__/CategoryRow.test.tsx`

**Interfaces:**
- Consumes: `subtitle` prop from Task 2's `ChannelCard`
- Produces: `CategoryRow` now accepts optional `subtitleFor?: (c: Channel) => string | undefined`; passes result as `subtitle` to each `ChannelCard`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/CategoryRow.test.tsx` inside the existing `describe` block:

```ts
it("passes subtitle to ChannelCard via subtitleFor", () => {
  const subtitleFor = (c: Channel) => c.id === "a" ? "Now · Test Show" : undefined;
  render(
    <CategoryRow
      title="News"
      channels={channels}
      onSelect={() => {}}
      subtitleFor={subtitleFor}
    />
  );
  expect(screen.getByText("Now · Test Show")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/CategoryRow.test.tsx
```

Expected: new test fails (prop not accepted / subtitle not rendered).

- [ ] **Step 3: Add `subtitleFor` prop to `CategoryRow`**

Update `src/components/CategoryRow.tsx` props and the `ChannelCard` render in the non-`onRemove` branch:

```tsx
export function CategoryRow({
  title, channels, onSelect, onRemove, onSeeAll, limit, subtitleFor,
}: {
  title: string;
  channels: Channel[];
  onSelect: (c: Channel) => void;
  onRemove?: (c: Channel) => void;
  onSeeAll?: () => void;
  limit?: number;
  subtitleFor?: (c: Channel) => string | undefined;
}) {
```

In the map, update the non-`onRemove` branch:

```tsx
: (
  <ChannelCard key={c.id} channel={c} onSelect={onSelect} subtitle={subtitleFor?.(c)} />
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/CategoryRow.test.tsx
```

Expected: all 5 tests pass (4 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryRow.tsx __tests__/CategoryRow.test.tsx
git commit -m "feat: add subtitleFor prop to CategoryRow for EPG subtitle pass-through"
```

---

## Task 4: Wire EPG search into `SearchView`

**Files:**
- Modify: `src/components/SearchView.tsx`
- Test: `__tests__/SearchView.test.tsx` (new file)

**Interfaces:**
- Consumes:
  - `useEpg(): EpgMap` from `@/hooks/useEpg`
  - `searchProgrammes(epgMap, channels, query, exclude): EpgResult[]` from `@/lib/search` (Task 1)
  - `subtitleFor` on `CategoryRow` (Task 3)
  - `EpgResult` type from `@/lib/search`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing tests**

Create `__tests__/SearchView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchView } from "@/components/SearchView";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Mock useChannels
const channels = [
  { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["http://x/cnn"], category: "News", languages: [], countries: [] },
  { id: "BBC.gb", name: "BBC News", logo: "", streamUrls: ["http://x/bbc"], category: "News", languages: [], countries: [] },
];
vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({ channels }),
}));

// Mock storage
vi.mock("@/lib/storage", () => ({
  getRecents: () => [],
  setLastChannel: vi.fn(),
  pushRecent: vi.fn(),
}));

// Mock useEpg
const epgMap = {
  "CNN": { now: { channel: "CNN", start: 0, stop: 9999999999999, title: "World Cup Final" } },
};
vi.mock("@/hooks/useEpg", () => ({
  useEpg: () => epgMap,
}));

describe("SearchView EPG section", () => {
  it("shows On now · Next section when EPG matches the query", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "world cup");
    expect(screen.getByText("On now · Next")).toBeInTheDocument();
    expect(screen.getByText("Now · World Cup Final")).toBeInTheDocument();
  });

  it("hides On now · Next section when query matches no EPG titles", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "zzz");
    expect(screen.queryByText("On now · Next")).not.toBeInTheDocument();
  });

  it("shows Channels section for name matches", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "bbc");
    expect(screen.getByText(/^Channels/)).toBeInTheDocument();
  });

  it("does not show a channel in both sections (dedup)", async () => {
    // "cnn" matches CNN by name AND by EPG — should only appear under Channels
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "world cup");
    // CNN appears in EPG section (World Cup Final is on CNN.us, EPG key "CNN")
    // CNN does NOT match by name for "world cup"
    // So it only appears in the EPG section — verify the subtitle shows
    const subtitleEl = screen.queryByText("Now · World Cup Final");
    expect(subtitleEl).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/SearchView.test.tsx
```

Expected: tests fail because `SearchView` doesn't yet render the "On now · Next" section.

- [ ] **Step 3: Update `SearchView`**

Full updated `src/components/SearchView.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { useChannels } from "@/hooks/useChannels";
import { useEpg } from "@/hooks/useEpg";
import { isBackKey } from "@/lib/keys";
import { searchChannels, searchProgrammes } from "@/lib/search";
import type { EpgResult } from "@/lib/search";
import { getRecents, setLastChannel, pushRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];
const BROWSE_LIMIT = 20;

export function SearchView() {
  const router = useRouter();
  const { channels } = useChannels();
  const list = useMemo(() => channels ?? [], [channels]);
  const epg = useEpg();
  const [q, setQ] = useState("");
  const backRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const typing = q.trim().length > 0;

  const nameResults = useMemo(() => searchChannels(list, q), [list, q]);

  const epgResults = useMemo((): EpgResult[] => {
    if (!q.trim()) return [];
    const exclude = new Set(nameResults.map((c) => c.id));
    return searchProgrammes(epg, list, q, exclude);
  }, [epg, list, q, nameResults]);

  const epgSubtitleMap = useMemo(
    () => new Map(epgResults.map((r) => [r.channel.id, r.subtitle])),
    [epgResults],
  );

  const byId = new Map(list.map((c) => [c.id, c]));
  const recents = getRecents().map((id) => byId.get(id)).filter(Boolean) as Channel[];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const editing = document.activeElement === inputRef.current && q !== "";
      if (isBackKey(e) || (e.key === "Backspace" && !editing)) router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, q]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  const focusFirstResult = () =>
    resultsRef.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();

  const bothEmpty = nameResults.length === 0 && epgResults.length === 0;

  return (
    <main className="search-main">
      <div className="search-bar">
        <button
          ref={backRef}
          data-focusable
          aria-label="Back"
          className="icon-btn"
          onClick={() => router.push("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); router.push("/"); }
            if (e.key === "ArrowDown") { e.preventDefault(); inputRef.current?.focus(); }
          }}
        >
          ‹
        </button>
        <div className="search-field">
          <span className="search-field__icon" aria-hidden>🔍</span>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); focusFirstResult(); }
              if (e.key === "ArrowUp") { e.preventDefault(); backRef.current?.focus(); }
            }}
            placeholder="Search channels…"
            className="search-input"
          />
        </div>
      </div>

      <div
        ref={resultsRef}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); inputRef.current?.focus(); }
        }}
      >
        {typing ? (
          bothEmpty ? (
            <p className="search-empty">No channels match "{q.trim()}".</p>
          ) : (
            <>
              <CategoryRow
                title={`Channels`}
                channels={nameResults}
                onSelect={open}
              />
              <CategoryRow
                title="On now · Next"
                channels={epgResults.map((r) => r.channel)}
                onSelect={open}
                subtitleFor={(c) => epgSubtitleMap.get(c.id)}
              />
            </>
          )
        ) : (
          <>
            <CategoryRow title="Continue Watching" channels={recents} onSelect={open} />
            {ORDER.map((cat) => (
              <CategoryRow
                key={cat}
                title={cat}
                channels={list.filter((c) => c.category === cat)}
                limit={BROWSE_LIMIT}
                onSelect={open}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass (199+ existing + new SearchView + updated search/ChannelCard/CategoryRow tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchView.tsx __tests__/SearchView.test.tsx
git commit -m "feat: EPG title search in SearchView (On now · Next section)"
```

---

## Self-Review

**Spec coverage:**
- `searchProgrammes`: ✅ Task 1
- `EpgResult` type: ✅ Task 1
- `ChannelCard subtitle` prop: ✅ Task 2
- `.channel-card__subtitle` CSS: ✅ Task 2
- `CategoryRow subtitleFor`: ✅ Task 3
- `SearchView` EPG wiring: ✅ Task 4
- Dedup (exclude set): ✅ Task 1 + Task 4
- Empty / pre-typing state unchanged: ✅ Task 4 (pre-typing block untouched)
- Both empty → "No channels match" message: ✅ Task 4 (`bothEmpty` guard)

**Placeholder scan:** None found.

**Type consistency:**
- `EpgResult` defined in Task 1, imported in Task 4 ✅
- `subtitleFor` defined in Task 3, consumed in Task 4 ✅
- `subtitle` prop defined in Task 2, passed in Task 3 ✅
- `searchProgrammes` signature in Task 1 matches call in Task 4 ✅
