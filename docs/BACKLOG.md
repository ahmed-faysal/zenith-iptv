# Zenith — Backlog & Known Issues

Single source of truth for outstanding work. The long changelog of shipped fixes
that used to live here is now in git history (`git log`). This file tracks only
what's **still open** plus the research worth keeping.

Last reviewed: 2026-06-21 (holistic review — unified browse views, fixed category
grid D-pad nav, removed dead ChannelSidebar, refreshed docs; then added automatic
stream failover, branch `stream-fallback`).

---

## ✅ Current state

- **Browse** — one `BrowseView({ category })` drives both `/` (rows) and
  `/category/[slug]` (vertical grid). Categories are real routes, so Back from
  the player returns to the page you came from.
- **Remote nav** — `useGridFocus` (row-to-row, column-preserving) + `useGridNav`
  (2-axis nav over the category grid) + `useFocusNav` (within a row). Initial
  focus on every screen; webOS Back (keyCode 461) handled.
- **Player** — glassy auto-hiding overlay: Back, LIVE, name, quality picker,
  clock, center play/pause, favorite, volume/mute, fullscreen. No scrubber (live).
  Automatic **source failover**: each channel carries up to 4 stream URLs and the
  player advances to the next when one fails (see below).
- **Data** — iptv-org M3U behind `/api/channels`, merged with a build-time
  `enrichment.json` (canonical category, reliable country, best logo, quality, and
  alternate stream URLs). See the
  [enrichment spec](superpowers/specs/2026-06-19-channels-json-enrichment-design.md)
  and [stream-fallback spec](superpowers/specs/2026-06-21-stream-fallback-design.md).
- **Stream failover** — `Channel.streamUrls: string[]` (M3U primary first, then
  iptv-org `streams.json` alternates, deduped, capped at 4). 2,287 channels carry
  a backup; the player tries them in order, surfacing "Stream unavailable" only
  when all are exhausted.
- **Tests** — 157 passing; lint + production build clean.

---

## 🧭 Pending (need account/device or a running pipeline)

- [ ] **Redeploy to Vercel.** Initial deploy is live (`zenith-iptv.vercel.app`,
  set as `main` in [webos/appinfo.json](../webos/appinfo.json)); push the latest
  `main` so the deploy reflects current commits (`git push` triggers it, or
  `npx vercel --prod`).
- [ ] **Install on the LG TV.** Follow [webos/README.md](../webos/README.md):
  add placeholder icons, `ares-package webos/`, install the `.ipk` via the
  Homebrew Channel.
- [~] **Activate EPG ("now / next") — READY, just needs the env var.** The
  scheduled Action is healthy: the `epg` branch is force-pushed every ~6h, the
  `guide.xml.gz` is ~17 MB and current (verified 2026-06-21). Parsed locally it
  yields **2,895 channels with schedules / ~2,859 with a live "now" programme**,
  in ~430 ms — well within serverless limits, and ids are in iptv-org
  `Name.CountryCode` convention so they match our channels. The route already
  degrades gracefully to `{}` on any error, so flipping it on cannot break the
  app. **To activate:** set
  `EPG_GUIDE_URL=https://raw.githubusercontent.com/ahmed-faysal/zenith-iptv/epg/guide.xml.gz`
  in Vercel (and `.env.local` for dev), then redeploy. The earlier OOM concern was
  the CI grabber, which is now working; `EPG_COUNTRIES` scoping is optional tuning,
  no longer a blocker.

---

## 🚧 Planned — building one by one (multi-source coverage)

Goal: broaden channel coverage (and reliability) by merging several M3U sources,
plus play stream formats we currently can't. Source vetting was done via
gitresearcher (see knowledge base). Build in this order:

1. **Multi-source playlist merge** (designing now). Merge a curated registry of
   M3U sources behind the existing `/api/channels` seam: parse each, apply
   per-source metadata defaults, and union by channel identity (exact `tvg-id`,
   else normalized name + country) so the same channel across sources contributes
   **backup URLs** (feeds the failover, capped at `MAX_SOURCES`); unmatched
   entries broaden coverage. `Promise.allSettled` so a dead source is skipped.
   Adult playlists are never registered + a keyword safety filter. **Within-source
   URL union too** (some sources group multiple URLs per channel). Starting
   registry: **iptv-org** (canonical) → **Free-TV/IPTV** (curated, no-adult,
   daily-updated, iptv-org-style ids → real backup merges) → **atsushi444
   `jp.m3u`** (JP) → **atsushi444 `tv.m3u`**. Spec to be written.
2. **mpegts.js playback fallback.** Some IPTV streams are raw MPEG-TS / HTTP-FLV,
   which hls.js can't play — they currently dead-end as "Stream unavailable". Add
   `mpegts.js` as a fallback player so those channels play (playability/coverage
   win; surfaced from `4gray/iptvnator`, which pairs it with hls.js).
3. **Robust M3U parsing via `iptv-playlist-parser`** (optional). The npm lib (by
   the iptvnator author) handles more `#EXTINF` edge cases than our hand-rolled
   `parseM3U` — useful for messy heterogeneous sources. Evaluate adopting it once
   the merge is in. (Supersedes the old "reference parsers" idea, #18.)

**Vetted sources (gitresearcher):** ✅ Free-TV/IPTV (add), ✅ atsushi444 SFW lists
(add, coverage-only — JP ids don't match iptv-org). ❌ joevess/IPTV (dead, 0
channels). ❌ HerbertHe/iptv-sources (self-host service, fragile personal
endpoint, China-centric, stale). ❌ 4gray/iptvnator (a player, ships no
channels — but source of the mpegts.js / parser ideas above). Future Xtream
Codes / Stalker portal support (account-based sources) also noted from iptvnator.

---

## 🟢 Open watch-items

- [ ] **OLED burn-in (LG C3).** Row titles and the TopBar sit in the same screen
  position every session. Low risk (dark theme mitigates), but keep home chrome
  low-luminance and avoid bright fixed badges/logos; revisit if an always-on HUD
  is added.
- [ ] **Geo-blocked channels.** Some streams are region-locked; the card shows a
  "Geo-blocked" flag. No in-app fix is possible (a browser can't change its IP) —
  a VPN is the only workaround. Documented here so it isn't re-investigated.

---

## 🔮 Future ideas

Full, verified triage (viable / parked / rejected with reasons) lives in
**[IDEAS.md](IDEAS.md)** — the single source for what's worth building next. Top
in-browser picks: error-recovery-by-type, alt_names search, Most Watched.

Parked from the original spec
([design](superpowers/specs/2026-06-16-personal-live-tv-design.md)):

- [ ] **App icon / logo** — hand-crafted SVG → PNG sizes for webOS + favicon.
- [ ] **Catchup / TV-archive** — parse `catchup` / `catchup-source` from `#EXTINF`
  to rewind live programming where supported.
- [ ] **PWA install** — manifest + service worker for clean phone install.
- [ ] **Multi-view** — watch several channels at once (cut from v1).
- [ ] **Xtream Codes / Stalker portal sources** — account-based source category
  (from `4gray/iptvnator`); lets users add premium/portal providers beyond M3U.
- [ ] **Cloudflare Pages migration** — only if the app ever goes commercial/public
  (Vercel free tier prohibits commercial use).

**Rejected after verification** (don't re-open): family-safety / NSFW filter
(iptv-org's public playlist already excludes adult content — 0 matching channels);
sending `User-Agent`/`Referer` stream headers (browser-forbidden headers, only a
server proxy could set them). Details in [IDEAS.md](IDEAS.md).

---

## 📺 EPG research (kept for when it's activated)

Why the obvious approaches don't work, so they aren't re-investigated:

- **On-demand per-channel EPG is not achievable from free sources.** No free,
  no-key, per-channel JSON API keys on our `tvg-id`s: `epg.pw` is bulk-only
  (per-country XMLTV, no single-channel/JSON), `epg.best` needs OAuth2, Tvheadend
  is a self-hosted PVR that itself needs EPG fed in, TVmaze is show metadata not
  linear now/next.
- **Pre-generated whole-country guides are too big to fetch on demand** (US alone
  ≈ 504 MB XMLTV; OOMs/timeouts a serverless function even gzipped).
- **`iptv-org/epg` is a generator you run**, not a hosted feed. Its
  `--channels <custom.xml>` flag scopes output to only our channels, producing a
  small `guide.xml(.gz)`. The channel→site mapping comes from the API's
  `guides.json`.

**Chosen design (implemented, dormant):** a scheduled GitHub Action builds a
`<channel>` list from `guides.json` filtered to our channels, runs the iptv-org/epg
grabber, and publishes a slim `guide.xml.gz` to an `epg` branch; `/api/epg` fetches
and parses it into a `now/next` map keyed on the **base `xmltv_id`** (our ids carry
an `@feed` suffix — the naive join matched ~1 channel; the base-id join maps
~3,605). Spec: [2026-06-18-epg-revival.md](superpowers/specs/2026-06-18-epg-revival.md).
