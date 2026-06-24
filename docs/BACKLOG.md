# Zenith — Backlog & Known Issues

Single source of truth for outstanding work. The changelog of shipped fixes lives
in git history (`git log`); this file tracks what's **still open** plus the
research worth keeping.

Last reviewed: 2026-06-25 — shipped webOS static export + EPG search; UX/reliability
polish pass (spinner, EPG idle pause, channel cache, search focus, grid reset).

---

## ✅ Current state (live in production)

- **Browse** — one `BrowseView({ category })` drives `/` (rows) and
  `/category/[slug]` (vertical grid); categories are real routes (history-aware
  Back).
- **Remote nav** — `useGridFocus` (row-to-row) + `useGridNav` (2-axis category
  grid) + `useFocusNav` (within a row); initial focus on every screen; webOS Back
  (keyCode 461).
- **Player** — glassy auto-hiding overlay (Back, LIVE, name, quality picker,
  clock, play/pause, favorite, volume/mute, fullscreen); no scrubber (live).
  **Automatic source failover** across a channel's `streamUrls` (cap
  `MAX_SOURCES = 4`): a dead source advances to the next ("Trying another
  source…"), "Stream unavailable" only when all are exhausted.
  [spec](superpowers/specs/2026-06-21-stream-fallback-design.md).
- **Multi-source catalogue** — `sources.ts` registry merged behind
  `/api/channels` (`merge.ts`): **iptv-org** (canonical) + **Free-TV/IPTV** +
  **atsushi444 `jp.m3u`/`tv.m3u`**. Identity union (real `tvg-id` via the
  `.`-heuristic, else normalized name + country) collects cross- and within-source
  **backup URLs** (feeds failover); `Promise.allSettled` skips a dead source;
  `http→https` upgrade in merge and enrichment. Live: ~13.1k channels, 2,585 with
  2+ URLs. [spec](superpowers/specs/2026-06-21-multi-source-merge-design.md).
- **Enrichment** — build-time `enrichment.json` (canonical category, reliable
  country, best logo, quality, alternate stream URLs) merged after the source
  merge. [spec](superpowers/specs/2026-06-19-channels-json-enrichment-design.md).
- **EPG ("now / next")** — ACTIVE. `/api/epg` parses the slim `guide.xml.gz` that
  the scheduled Action force-pushes to the `epg` branch (~6h); ~2,888 channels
  show "Now · …". `EPG_GUIDE_URL` set in Vercel prod + `.env.local` for dev.
  [spec](superpowers/specs/2026-06-18-epg-revival.md).
- **Deployed** — `zenith-iptv.vercel.app` (Vercel; production from `main`; the
  `epg` data branch is excluded from deploys via `vercel.json`).
- **webOS packaged app** — `scripts/build-webos.sh` produces a static export
  (`WEBOS_BUILD=1`, api/ dir temporarily moved out); CORS headers + absolute
  `NEXT_PUBLIC_API_BASE` let the `.ipk` call Vercel APIs from the TV's home IP.
  Routes migrated to query-params (`/watch?id=`, `/category?slug=`) for static
  export compatibility. [plan](superpowers/plans/2026-06-24-webos-static-export.md).
- **EPG keyword search** — "On now / next" section in SearchView; `searchProgrammes`
  over the loaded EPG map; subtitle on ChannelCard. [spec](superpowers/specs/2026-06-23-epg-search-design.md).
- **UX / reliability polish** — loading spinner on initial stream fetch (not just
  mid-playback stalls); EPG polling pauses via Page Visibility API when the app is
  backgrounded; `/api/channels` returns `Cache-Control: public, max-age=3600`;
  search input focus uses `useEffect` (webOS-safe); `useGridFocus` accepts a
  `resetKey` so category navigation re-lands focus correctly.
- **Tests** — 222 passing; lint clean (one pre-existing `<img>` warning) +
  production build clean.

---

## 🚧 Next up

1. [~] **Activate the stream proxy — BUILT, dormant; needs a Worker deploy + env.**
   A Cloudflare Worker HLS/CORS proxy (`worker/`) recovers the ~14% of channels
   that fail in-browser on mixed-content / missing CORS (mostly sports). Merged to
   `main` but **off** until configured (degrades off cleanly via
   `NEXT_PUBLIC_STREAM_PROXY_ENABLED`). The player routes failing channels through
   a same-origin `/api/proxy` (HMAC-signed, catalogue-scoped) → the Worker. **To
   activate:** `cd worker && wrangler secret put STREAM_PROXY_SECRET && wrangler
   deploy`; then in Vercel set `STREAM_PROXY_SECRET` (same), `STREAM_PROXY_WORKER_URL`
   (server-only), and `NEXT_PUBLIC_STREAM_PROXY_ENABLED=1`; redeploy; verify a
   known http/CORS channel (e.g. Fox Sports) plays.
   [spec](superpowers/specs/2026-06-22-stream-proxy-design.md).
2. [x] **EPG match / keyword search** — SHIPPED. Sectioned results in SearchView:
   channel-name matches + "On now / next" from the loaded EPG map.
3. [ ] **Install on the LG TV.** [webos/README.md](../webos/README.md): add
   placeholder icons, `ares-package webos/`, install the `.ipk` via the Homebrew
   Channel. (The only remaining deploy/device step.)

Beyond that, see [IDEAS.md](IDEAS.md) for the ranked in-browser picks (alt_names
search, "Most Watched", signal-quality chip).

### Measured & dropped (2026-06-21)

Both were queued, then measured against the real catalogue and dropped — recorded
here so they aren't re-investigated:

- **mpegts.js playback fallback — DROPPED.** Of 17,645 stream URLs in the live
  catalogue, **95.1% are HLS (`.m3u8`)** and only **14 are `.ts`/`.flv`**
  (0.08%). A second playback engine (~150 KB) for 14 channels isn't worth it.
  Revisit only if a future source brings substantial MPEG-TS/FLV content.
- **`iptv-playlist-parser` — SKIPPED.** Spiked against all four real sources: it
  recovers **763 more iptv-org entries** than our `parseM3U`, but **100% of those
  763 require `User-Agent`/`Referer` headers** (URL sits after `#EXTVLCOPT` lines)
  — browser-forbidden headers (see rejected #24), so they can't play on our
  target anyway. Our parser's "URL on the next line" behavior incidentally drops
  exactly that unplayable set; the playable channel set is identical. Not worth a
  dependency. (Closes the old "reference parsers" idea, #18.) **Do not "fix" the
  parser to recover these — they'd be dead channels.**

**Adding a source** is one line in `src/lib/sources.ts`. Vetted candidates
(gitresearcher): ✅ Free-TV/IPTV and ✅ atsushi444 SFW lists are already in.
❌ joevess/IPTV (dead, 0 channels), ❌ HerbertHe/iptv-sources (self-host service,
fragile personal endpoint, China-centric, stale), ❌ 4gray/iptvnator (a player,
ships no channels — but source of the mpegts.js / parser ideas above).

---

## 🟢 Open watch-items

- [ ] **OLED burn-in (LG C3).** Row titles and the TopBar sit in the same screen
  position every session. Low risk (dark theme mitigates), but keep home chrome
  low-luminance and avoid bright fixed badges/logos; revisit if an always-on HUD
  is added.
- [ ] **Geo-blocked channels.** Some streams are region-locked; the card shows a
  "Geo-blocked" flag. No in-app fix is possible (a browser can't change its IP) —
  a VPN is the only workaround. Documented here so it isn't re-investigated.
- [ ] **Mixed content / HTTP-only streams.** `http://` URLs are auto-upgraded to
  `https://` (recovers TLS-capable servers); genuinely http-only-no-TLS streams
  stay unplayable in-browser. Inherent browser limitation; a server proxy is the
  only fix and was rejected (impractical for live HLS on our infra).

---

## 🔮 Future ideas

Full, verified triage (viable / parked / rejected with reasons) lives in
**[IDEAS.md](IDEAS.md)** — the single source for what's worth building next. Top
in-browser picks: alt_names search, "Most Watched", a signal-quality chip.

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
- [ ] **EPG enhancements** — now that EPG is live: name fallback, `--json` grabber
  output (drop the regex parser), "What's on now" / live-event search, FAST-source
  guides. Details in [IDEAS.md](IDEAS.md) (EPG section).

**Rejected after verification** (don't re-open): family-safety / NSFW filter
(iptv-org's public playlist already excludes adult content — 0 matching channels);
sending `User-Agent`/`Referer` stream headers (browser-forbidden headers, only a
server proxy could set them). Details in [IDEAS.md](IDEAS.md).

---

## 📺 EPG — design & sources research (now active; kept for reference)

EPG is live (see Current state). The background below is kept so the rejected
approaches aren't re-investigated:

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

**Implemented design:** a scheduled GitHub Action builds a `<channel>` list from
`guides.json` filtered to our channels, runs the iptv-org/epg grabber, and
publishes a slim `guide.xml.gz` to the `epg` branch; `/api/epg` fetches and parses
it into a `now/next` map keyed on the **base `xmltv_id`** (our ids carry an
`@feed` suffix — the naive join matched ~1 channel; the base-id join maps ~2,888
live). Spec: [2026-06-18-epg-revival.md](superpowers/specs/2026-06-18-epg-revival.md).
