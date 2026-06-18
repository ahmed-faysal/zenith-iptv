# EPG Revival — "Now / Next" Program Guide

Status: **design + implementation** (branch `feat/epg-revival`)
Date: 2026-06-18
Backlog: revives #26 (removed in v1 / #1 when the old feed 404'd)

## Goal

Show "Now playing" (and "Next") for a channel, sourced from a free EPG, without
the failure mode that killed v1 (fetching/parsing a 500 MB country file on every
request). Coverage is inherently partial — many channels have no guide — so the
feature must **degrade silently**: no data → no overlay, never an error or a
blank.

## Why this shape (research, 2026-06-17/18)

- **No free, no-key, per-channel JSON EPG API exists** that keys on our
  `tvg-id`s (epg.pw = bulk only; epg.best = OAuth2; Tvheadend = self-hosted PVR;
  TVmaze = show metadata, not linear now/next). On-demand is out.
- **`iptv-org/epg` is a generator you run** (npm/Docker, no hosted feed). Its
  `--channels <custom.xml>` flag scopes output to *only our channels* → one slim
  `guide.xml`. The channel→site mapping comes from the API's `guides.json`.

So: **pre-build a slim guide in CI, host it, read it cheaply at request time.**

## Architecture

```
GitHub Action (cron ~6h)                 Next.js app (Vercel)
─────────────────────────                ─────────────────────
1. our channels  ─┐                      /api/epg
2. guides.json  ──┼─► custom.channels.xml   ├─ fetch slim guide.xml.gz (env URL)
3. iptv-org/epg grabber ─► guide.xml.gz     ├─ gunzip + parseXmltv → Map<id,Prog[]>
4. publish to `epg` branch ────────────────►├─ cache parsed (TTL 1h)
                                            └─ per request: nowNext(at=now) → JSON
                                          client: useEpg() → WatchView "Now · …"
```

**Key latency property:** programmes carry absolute start/stop timestamps and
the grabber pulls several days ahead, so "now" is computed *at request time* from
timestamps — a 6–12 h-old guide is still accurate. The request path only does an
in-memory map lookup; no scraping, no big parse.

## Data contracts

### `guides.json` (input, from iptv-org/api)
Array of `{ channel, site, site_id, lang }` (channel = the `xmltv_id`).

### `custom.channels.xml` (CI artifact, grabber input)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<channels>
  <channel site="example.com" lang="en" xmltv_id="BBCNews.uk" site_id="123">BBCNews.uk</channel>
</channels>
```
Built by `toChannelsXml(guides, ids)` — keeps only guides whose `channel` is in
our id set, deduped, attributes escaped.

### `guide.xml(.gz)` (CI output, app input) — standard XMLTV
```xml
<programme start="20260618120000 +0000" stop="20260618130000 +0000" channel="BBCNews.uk">
  <title lang="en">BBC News at One</title>
</programme>
```

### `GET /api/epg` (app → client)
```json
{ "BBCNews.uk": { "now": { "title": "…", "start": 1750000000000, "stop": … },
                  "next": { "title": "…", "start": …, "stop": … } } }
```
- `now`/`next` optional. Channels with no current programme are omitted.
- Times are epoch ms. Empty object `{}` when the guide is unset/unreachable.

## Modules

| File | Responsibility | Tested |
|---|---|---|
| `src/lib/epg.ts` | `parseXmltvDate`, `parseXmltv`, `buildGuide` (Map<id,Prog[]> sorted), `nowNext` | ✅ unit |
| `src/lib/epg-channels.ts` | `toChannelsXml(guides, ids)` | ✅ unit |
| `src/lib/epg-source.ts` | TTL-cached fetch + gunzip + `buildGuide` (factory, mirrors `source.ts`) | — glue |
| `src/app/api/epg/route.ts` | compute `nowNext` per channel at request time → JSON | — glue |
| `src/hooks/useEpg.ts` | client fetch of `/api/epg`, cached in module scope | — glue |
| `src/components/WatchView.tsx` | subtitle becomes `Now · <title>` when present | — on-device |
| `scripts/build-epg-channels.ts` | CI: our channels ∩ guides.json → `custom.channels.xml` | — CI |
| `.github/workflows/epg.yml` | cron: build channels.xml, run grabber, publish slim guide | — CI |

## Config (env)

- `EPG_GUIDE_URL` — published slim guide (`…/epg/guide.xml.gz`). **Unset →
  `/api/epg` returns `{}`** (feature dormant; no errors). Set after the repo has
  a remote + the Action has published once.
- `EPG_COUNTRIES` (CI only, optional) — comma list to scope the channel set for a
  smaller, healthier guide (coverage is best per-country). Default: all.

## Scope / non-goals (this branch)

- **In:** WatchView "Now · …" (and Next where shown), the full pipeline, graceful
  dormancy when unconfigured.
- **Out (follow-up):** per-card "now playing" on Home (#10) — needs EPG joined
  into the channel list/home fetch; deferred to keep blast radius small.
- **Out:** catch-up/rewind (#15), guide grid view.

## Coverage findings (verified 2026-06-18 against live data)

Smoke-testing the builder surfaced two data realities of the current
`index.m3u` source:

1. **`@feed` suffix on ids.** Our `Channel.id` keeps iptv-org's feed suffix
   (`1Plus1International.ua@HD`, `123tv.de@SD`) so each feed is a distinct entry,
   but `guides.json` keys on the **base** xmltv_id (feed is a separate field).
   Matching raw ids gave **1**; matching the base id (strip `@feed`) gives
   **3,605** channels. → `baseChannelId()` is applied at both join points (CI
   builder + WatchView lookup). This is the difference between the feature being
   dead and useful.
2. **No `tvg-country` in `index.m3u`.** All `countries` are empty, so
   `EPG_COUNTRIES` scoping yields zero — left empty until the **channels.json
   data-source upgrade (#21)** adds country data. Without scoping the grab covers
   ~3.6k channels (slim vs. the 167k-entry guide universe).

So real coverage today is **~3,605 mapped channels** (ceiling; actual programme
data depends on each guide site's health), not the ~5 the first naive join
suggested. Adopting #21 would add country scoping and likely widen the id match.

## Risks

- Upstream scraper sources break/recover (green/yellow/red). Mitigation: keep
  last-good guide; show only when present.
- Partial coverage is expected and acceptable; UI must never imply completeness.
- Grabbing ~3.6k channels × 2 days is a non-trivial Action run; if too slow, drop
  `--days` to 1 or scope once #21 provides country data.
- Cron commit noise → publish to a dedicated `epg` branch, not `main`.
