# EPG Search — Design

**Date:** 2026-06-23  
**Status:** Approved  

## Problem

The existing `SearchView` searches only channel names. A user who wants to find
"what's on now" for a live event (e.g. "world cup", "F1") gets nothing unless
they already know the channel name. The EPG data is already loaded client-side
via `useEpg()` — surfacing it in search is a pure UI extension.

## Goal

When a user types a query, show a second results section — **"On now · Next"**
— listing channels whose current or upcoming programme title matches. Each card
shows the programme title as a subtitle so the user knows why it appeared.

Non-goals: full programme schedule / "what's on at 9pm"; searching past or
future programmes beyond `now`/`next`; any server-side change.

## Architecture

Three small, isolated changes — no new routes, no new hooks, no new pages.

### 1. `src/lib/search.ts` — `searchProgrammes`

```ts
export type EpgResult = { channel: Channel; subtitle: string };

export function searchProgrammes(
  epgMap: EpgMap,           // from useEpg()
  channels: Channel[],
  query: string,
  exclude: Set<string>,     // channel ids already in name results
  limit = 30,
): EpgResult[]
```

- Lowercase substring match against `epgMap[baseChannelId(c.id)]?.now?.title`
  and `…?.next?.title` for each channel.
- `subtitle` = `"Now · {title}"` or `"Next · {title}"` (now preferred if both
  match).
- Skips channel ids in `exclude` set.
- Returns at most `limit` results (first-match order from the channel list, so
  favourites naturally surface first if the list is ordered that way).
- Empty query → `[]` (same guard as `searchChannels`).

### 2. `src/components/ChannelCard.tsx` — `subtitle` prop

Add optional `subtitle?: string`. Rendered below `channel-card__title` in a
new `<span className="channel-card__subtitle">`. CSS: same muted small-text
treatment as `.channel-card__flags` (no new colour tokens needed, reuse
`opacity: 0.6` + `font-size: 0.7rem`).

The prop is purely display — it does not affect click/key behaviour or focus.

### 3. `src/components/SearchView.tsx` — second results section

- Add `useEpg()` at the top of the component.
- When `typing`:
  - Compute `nameResults = searchChannels(list, q)` (unchanged).
  - Compute `exclude = new Set(nameResults.map(c => c.id))`.
  - Compute `epgResults = searchProgrammes(epg, list, q, exclude)`.
  - Render "Channels" `CategoryRow` if `nameResults.length > 0`.
  - Render "On now · Next" `CategoryRow` if `epgResults.length > 0`.
  - Pass `subtitle` to `ChannelCard` via `CategoryRow`'s `onSelect` wrapper;
    `CategoryRow` needs a `subtitleFor?: (c: Channel) => string | undefined`
    prop so it can pass through to `ChannelCard`.
  - "No channels match" message only when **both** are empty.
- Pre-typing state (recents + category browse) is **unchanged**.

### `CategoryRow` — `subtitleFor` prop

`CategoryRow` already maps channels → `ChannelCard`. Add:
```ts
subtitleFor?: (c: Channel) => string | undefined
```
Passed straight through to `ChannelCard`'s `subtitle` prop. Callers that don't
need it omit it — fully backwards-compatible.

## Data flow

```
useEpg() → epgMap (Record<baseId, NowNext>)
useChannels() → channels[]

[user types query]
  searchChannels(channels, q) → nameResults[]
  searchProgrammes(epgMap, channels, q, exclude) → epgResults[]

  <CategoryRow title="Channels" channels={nameResults} />
  <CategoryRow title="On now · Next" channels={epgResults.map(r=>r.channel)}
               subtitleFor={id => epgResultsMap.get(id)?.subtitle} />
```

## Error / empty states

| Situation | Behaviour |
|---|---|
| EPG not yet loaded | `epgMap = {}` → `epgResults = []` → section hidden |
| No name matches, EPG matches only | "Channels" section hidden; only "On now · Next" shows |
| No EPG matches, name matches only | "On now · Next" section hidden; existing behaviour |
| Both empty | "No channels match" message (same as today) |
| Channel in both | Appears only in "Channels" (excluded from EPG section) |

## Testing

- **`__tests__/search.test.ts`** (extend existing file):
  - `searchProgrammes`: empty query → `[]`; matches `now.title`; matches
    `next.title`; prefers `now` when both match; excludes ids in `exclude` set;
    caps at `limit`; no EPG entry → skipped silently.
- **`ChannelCard`**: snapshot / render test with `subtitle` present and absent.
- **`SearchView`** (if integration tests exist): typing a query that has EPG
  matches renders the "On now · Next" row.

## Files

**Modify:**
- `src/lib/search.ts` — add `searchProgrammes` + `EpgResult` type
- `src/components/ChannelCard.tsx` — add `subtitle` prop + `.channel-card__subtitle` span
- `src/components/CategoryRow.tsx` — add `subtitleFor` prop, pass to `ChannelCard`
- `src/components/SearchView.tsx` — add `useEpg`, compute epgResults, render second section
- CSS (`globals.css` or equivalent) — `.channel-card__subtitle` style

**Unchanged:** all hooks, all routes, `WatchView`, `BrowseView`, EPG API.
