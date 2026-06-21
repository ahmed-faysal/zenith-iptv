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
- [~] **Activate EPG ("now / next").** The plumbing exists (`/api/epg`, `useEpg`,
  "Now · …" subtitle in the player) and a scheduled build is wired in
  [`.github/workflows/epg.yml`](../.github/workflows/epg.yml). It stays dormant
  until the Action publishes a `guide.xml.gz` to the `epg` branch and
  `EPG_GUIDE_URL` is set in Vercel. **Open tuning:** the grabber is slow/OOM-prone
  against all channels — scope `EPG_COUNTRIES` (e.g. `US,GB,CA,AU,IN,AE`) to keep
  the run small. Background + source research in the EPG section below.

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
- [ ] **Multi-source playlist merge** — combine/curate multiple M3U sources behind
  the existing `/api/channels` seam.
- [ ] **Multi-view** — watch several channels at once (cut from v1).
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
