# Channel Enrichment — channels.json / logos.json / streams.json

Status: **design** (branch `feat/channels-json-enrich`)
Date: 2026-06-19
Backlog: implements #21 (data-source upgrade), #23 (better logos), #25 (quality
metadata). Supersedes the literal "#21 replace M3U" with a hybrid enrich design.

## Goal

Enrich the channel list with authoritative iptv-org metadata — canonical
**categories**, **country**, best **logo**, and **quality** — without losing the
M3U's curation, dedup, feed-join, or the stable ids our favorites depend on.

## Why this shape (verified against live data 2026-06-19)

- `index.m3u` is already a curated, deduped, pre-joined view: stream URL + a
  `channel@feed` `tvg-id` (e.g. `1Plus1International.ua@HD`). Favorites/recents are
  keyed on exactly this id. **It stays the spine.**
- `channels.json` (9.5 MB, 39,924) has metadata but **no logo, no stream**.
- `logos.json` (6.7 MB, 41,484) has multiple logos/channel with `in_use`,
  `format`, dimensions.
- `streams.json` (3.1 MB, 15,579) has `quality`/`url` keyed by `channel`+`feed`;
  **2,564 records have `channel: null`** (unmappable).
- Coverage on our 9,720 M3U ids: country **9,183/9,183**, categories
  **7,758**, a logo **9,016**. `is_nsfw=true`: **0** — `index.m3u` already
  excludes adult content, so the family filter (#22) is a no-op here and is
  **explicitly out of scope** (see Non-goals).

So: **fetch the 19 MB and join at BUILD time**, ship a slim lookup, keep the
runtime exactly as cheap as today.

## Architecture

```
BUILD time  (npm run gen:channels — committed artifact)   RUNTIME (per request / cold start)
──────────────────────────────────────────────────       ──────────────────────────────────
fetch index.m3u → parseM3U → the exact runtime ids        fetch index.m3u (2.5 MB, fresh)
fetch channels.json + logos.json + streams.json           parseM3U → base channels
  → for each M3U id (channel@feed):                        load src/data/enrichment.json (bundled)
      base = baseChannelId(id)                             merge enrichment[id] onto each channel
      { category, country, logo, quality }                → Channel[]  (same cost as today)
  → write src/data/enrichment.json  (keyed by M3U id)
```

**Key property:** the generator keys the map by the *same* id the runtime uses
(`channel@feed`), by reusing `parseM3U` for id derivation — so the runtime merge
is a direct `enrichment[channel.id]` lookup with no re-derivation or drift.

**Vercel fit:** no request-time fetch beyond today's 2.5 MB M3U; the 19 MB is
paid only at build. The enrichment file is bundled into the deployment, so it
survives serverless cold starts with zero cost. No reliance on Vercel cache
internals or function time/memory headroom.

**Freshness:** enrichment refreshes when `gen:channels` is re-run (committed to
the repo for network-free, reproducible builds in dev / CI / Vercel). Metadata
changes slowly; manual refresh now, a daily CI job later (same pattern as EPG).

## Data contracts

### `src/data/enrichment.json` (build artifact, app input)
```json
{ "1Plus1International.ua@HD": {
    "category": "Entertainment", "country": "UA",
    "logo": "https://.../1plus1.png", "quality": "1080p" } }
```
- Keyed by the runtime `Channel.id` (`channel@feed`). Values are optional fields.
- Channels absent from the map (unmapped M3U ids, stale ids) simply get no
  enrichment and fall back to M3U-derived values.

### `Channel` (extended — `src/lib/types.ts`)
```ts
type Channel = {
  id: string; name: string; logo: string; streamUrl: string;
  category: AppCategory;        // canonical map (primary) → keyword fallback
  languages: string[]; countries: string[];   // countries now reliably populated
  quality?: string | null;      // NEW — from streams.json, else null
};
```
- No `isNsfw` (family filter dropped), no `altNames`/headers (not in scope —
  YAGNI). Only `quality` is added, and **optional** so existing `Channel`
  fixtures across the test suite need no change; `category`/`countries`/`logo`
  change source, not shape.

## Modules

| File | Responsibility | Tested |
|---|---|---|
| `src/lib/enrich.ts` (new) | pure: `bestLogo(logos)`, `canonicalCategory(ids)`, `buildEnrichment(m3uIds, channels, logos, streams)` | ✅ unit |
| `src/lib/categories.ts` | canonical iptv-org category id → `AppCategory` map; keep keyword fallback for unmapped | ✅ unit |
| `scripts/gen-channels.ts` (new) | CI/build glue: fetch 4 sources, call `buildEnrichment`, write `src/data/enrichment.json` | — glue |
| `src/lib/source.ts` | after `parseM3U`, merge bundled `enrichment.json` onto each channel | ✅ unit (merge) |
| `src/lib/m3u.ts` | add `quality` (default null); `category` now set by source-layer merge, M3U keyword as fallback | ✅ unit |
| `src/components/ChannelCard.tsx` | quality chip prefers `channel.quality`, falls back to `parseChannelName` | — visual |
| `package.json` | `gen:channels` script; optional `prebuild` hook deferred (committed artifact) | — |

## Logic details

- **`bestLogo(logos)`**: filter `in_use` first; rank `format` SVG > WebP > PNG >
  others (SVG scales for TV); tie-break larger area; prefer feed-specific over
  channel-level when an M3U id carries a feed. Returns a URL or `undefined`.
- **`canonicalCategory(ids)`**: map canonical category ids (`news`, `sports`,
  `movies`, `kids`, `music`, `entertainment`, `general`, …) → `AppCategory` by
  priority; first match wins; `undefined` → let caller use keyword fallback.
- **Merge precedence (runtime)**: enrichment value when present, else M3U-derived
  value (logo → tvg-logo; category → keyword guess; quality → `parseChannelName`).

## Resilience

- `index.m3u` is the only required input (unchanged). All enrichment is
  best-effort: a missing/empty `enrichment.json` → app runs as bare M3U (today's
  behavior). The generator on fetch failure writes an empty `{}` and logs, so a
  flaky build never ships a broken app.

## Testing (TDD)

Pure functions get unit tests written first: `bestLogo` (format/in_use/size
ranking, feed preference), `canonicalCategory` (priority, multi-category,
unknown), `buildEnrichment` (join by base id, quality by `channel@feed`, absent
channels omitted), and the source-layer merge (precedence + fallback). The
generator script and ChannelCard chip are thin glue/visual (untested, per repo
convention — mirrors `build-epg-channels.ts`).

## Non-goals (this branch)

- **Family-safety filter (#22)** — `index.m3u` has zero `is_nsfw` channels;
  filtering would be theater. Revisit only if the source ever changes.
- **alt_names search (#19), stream headers (#24), feeds.json `format` (#17 via
  feeds)** — not in scope; quality comes from `streams.json` (#25) only.
- **Daily CI refresh of `enrichment.json`** — deferred to deploy time (needs the
  same remote as EPG); for now the artifact is regenerated manually via
  `gen:channels`.

## Risks

- Generated artifact goes stale between regenerations — acceptable for
  slow-changing metadata; mitigated by the manual `gen:channels` + later CI job.
- Committed ~1–2 MB data file creates noisy diffs on regeneration — acceptable
  for a personal project; keeps builds network-free and Vercel-safe.
