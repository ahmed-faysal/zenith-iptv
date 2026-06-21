# Multi-Source Playlist Merge — Design

**Date:** 2026-06-21
**Status:** Approved (brainstorming) — pending implementation
**Branch:** `multi-source-merge`

## Problem

Zenith plays only iptv-org's `index.m3u`. Many regions/channels iptv-org lacks are
covered by other public M3U sources, and the same channel often exists in several
sources — extra URLs that could serve as failover backups. We want one curated
catalogue merged from multiple sources: broader coverage, and more backup URLs
feeding the failover shipped in `streamUrls`.

## Goal

Merge a small, curated registry of M3U sources behind the existing
`/api/channels` seam. The same channel found in multiple sources (or listed
multiple times within one source) collapses into one channel whose `streamUrls`
is the union of its URLs (deduped, capped at `MAX_SOURCES`); everything else
broadens coverage. Adult content stays excluded. EPG is out of scope here.

Non-goals: Xtream Codes / Stalker portals (future), non-HLS playback (separate
`mpegts.js` follow-up), build-time catalogue bundling.

## Starting registry

| # | Source | Notes |
|---|--------|-------|
| 0 | iptv-org `index.m3u` | canonical spine; full metadata + enrichment |
| 1 | Free-TV/IPTV `playlist.m3u8` | curated, no-adult, daily-updated; **iptv-org-style `tvg-id`s** → real cross-source backup merges |
| 2 | atsushi444 `jp.m3u` | Japanese coverage (JP ids don't match iptv-org → coverage-only) |
| 3 | atsushi444 `tv.m3u` | extra coverage (mixed) |

Registry order = priority. Grows by adding one entry later.

## Architecture

Runtime merge behind `/api/channels` (Approach A). All fetching/parsing/merging
happens in `source.ts`, cached 1h as today. Per-source failures are isolated.

### 1. Source registry — `src/lib/sources.ts` (new)

```ts
import type { AppCategory } from "./types";

export type Source = {
  label: string;            // provenance / logging
  url: string;
  country?: string;         // ISO code applied to entries missing tvg-country
  language?: string;        // applied to entries missing tvg-language
  category?: AppCategory;   // applied when the parsed category is the "Other" fallback
};

export const SOURCES: Source[] = [
  { label: "iptv-org",   url: "https://iptv-org.github.io/iptv/index.m3u" },
  { label: "free-tv",    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },
  { label: "atsushi-jp", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/jp.m3u", country: "JP", language: "Japanese" },
  { label: "atsushi-tv", url: "https://raw.githubusercontent.com/atsushi444/iptv/master/tv.m3u" },
];
```

### 2. Parser change — `src/lib/m3u.ts`

`parseM3U` currently de-dupes within a single text by id (keep-first), which would
**drop grouped backup URLs** when a source lists a channel multiple times. Remove
that within-source de-dupe: `parseM3U` returns **one Channel per `#EXTINF`**
(still `streamUrls: [url]`, id from `tvg-id` or slug fallback). All de-dup/union
moves to `mergeSources`. (The existing "de-duplicates… keeping the first" test
moves to the merge layer.)

### 3. Merge — `src/lib/merge.ts` (new)

```ts
export function mergeSources(lists: Channel[][]): Channel[]
```

- **Identity key** (conservative): use the channel `id` when it looks like a real
  `tvg-id` — i.e. it contains a `.` (the `Name.cc` convention, e.g. `CNN.us`,
  `ＮＨＫ総合….jp`). The slug fallback (`parseM3U` uses `slug(name)` when `tvg-id`
  is absent) never contains a `.`, so this cleanly distinguishes a real id from a
  generated one without adding a provenance field to `Channel`. Otherwise key on
  `normalizeName(name) + "|" + (countries[0] ?? "")`. `normalizeName` lowercases,
  strips resolution/quality tokens (`720p`,`1080p`,`hd`,`sd`,`fhd`,`uhd`,`4k`,
  parenthesised quality) and non-alphanumerics.
- Iterate sources in registry order; first occurrence of a key creates the
  channel; later occurrences **append their URL(s)** to `streamUrls` and **fill
  only missing** metadata (never override the first source's values). `streamUrls`
  is deduped and capped at `MAX_SOURCES` (4, imported from `enrich.ts`).
- Unmatched keys are added as new channels (coverage).
- Net effect: handles both within-source grouped backups and cross-source dupes
  with one pass over the pooled entries.

### 4. Per-source metadata defaults — applied in `source.ts` after parsing

For each parsed entry from a source: if `countries` is empty and the source has a
`country`, set it; same for `language`; if `category === "Other"` (the fallback)
and the source has a `category`, use it. Never override real parsed values.

### 5. Adult safety — `isAdult(name, group)` in `merge.ts`

Adult playlists are never in the registry. Defense-in-depth: drop any entry whose
name or group-title matches an adult keyword regex, case-insensitive, with
word-boundaries on short/ambiguous words to avoid false positives like "Sussex":
`xxx`, `porn`, `adult`, `18+`, `\bsex\b`, `erotic`, `playboy`, `brazzers`,
`hustler`. Applied during merge. (Exact final list locked in the plan.)

### 6. Fetch & resilience — `src/lib/source.ts`

```
fetch all SOURCES in parallel via Promise.allSettled
  -> for each fulfilled: parseM3U(text), apply per-source defaults, drop isAdult
  -> mergeSources(allLists)
  -> applyEnrichment(merged, enrichment)   // unchanged; keyed by iptv-org ids
  -> cache 1h
A rejected source is logged and skipped. If ALL sources fail, throw (error UI).
```

Enrichment runs after merge: iptv-org-originated channels still match by id (they
keep iptv-org's id as canonical), gaining category/logo/quality and any
`streams.json` alternates (appended after the merged source URLs, capped at 4).
External-only channels keep their M3U logo + per-source defaults.

## Data flow

```
SOURCES ─allSettled─▶ parseM3U + defaults + adult-filter (per source)
       ─▶ mergeSources (identity union, cap 4) ─▶ applyEnrichment ─▶ cache ─▶ /api/channels
```

## Error handling & risks

| Concern | Handling |
| --- | --- |
| A source is down / 404 / garbage | `allSettled` skips it; catalogue still served |
| All sources fail | throw → existing "Could not load channels" UI |
| Within-source grouped backups | captured (parseM3U no longer drops dup ids) |
| Wrong channels merged | conservative identity (tvg-id, else name+country) |
| Adult content | not registered + keyword filter |
| **Mixed content** | HTTP-only streams (e.g. some Free-TV entries) are browser-blocked on our HTTPS deploy — can't fix client-side; HTTPS streams play. Known limitation. |
| Quality/legality of community streams | accepted trade-off for coverage |
| Cross-language dupes (JP/EN) | won't match → added as new (coverage, not backup) — expected |

## Testing

`__tests__/merge.test.ts` (new):
- union URLs for same `tvg-id` across sources; deduped; capped at `MAX_SOURCES`.
- merge by normalized name + same country; **no** merge across different countries.
- within-source grouped backups (same id twice in one list) union into one channel.
- unmatched entries added as new channels.
- first source wins metadata; later sources fill only missing fields.
- `normalizeName` strips quality/resolution tokens.
- `isAdult` drops flagged entries; does not false-positive on "Sussex"/"Essex".

`__tests__/m3u.test.ts` (update): `parseM3U` returns one entry per `#EXTINF`
(no within-source de-dupe); the old keep-first assertion moves to merge tests.

`__tests__/source...` (new or extend): `Promise.allSettled` skips a failing
source (inject a fetcher that rejects one URL); per-source defaults applied.

## Files

- New: `src/lib/sources.ts`, `src/lib/merge.ts`, `__tests__/merge.test.ts`
- Modify: `src/lib/m3u.ts` (drop within-source de-dupe), `src/lib/source.ts`
  (multi-fetch + merge), `__tests__/m3u.test.ts`
- Unchanged: `enrich.ts` (`MAX_SOURCES`, `applyEnrichment` reused as-is),
  `data/enrichment.json` (still iptv-org-keyed)

## Notes

- `MAX_SOURCES = 4` continues to bound total URLs per channel across all sources +
  enrichment.
- Performance: a handful of extra small playlists fetched in parallel, merged
  once per cache-miss (hourly). Acceptable.
