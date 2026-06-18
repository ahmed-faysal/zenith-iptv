# Ideas — Research Findings

Collected from: iptvnator (4gray/iptvnator), iptv-api (Guovin/iptv-api), iptv-org/iptv, iptv-org/database, iptv-org/awesome-iptv, Free-TV/IPTV
Status: **under review** — not committed to backlog yet

---

## Stream Quality & Health

**1. Pre-validated M3U sidecar** *(iptv-api)*
Docker job on cron speed-tests all streams via FFmpeg, filters dead ones, exposes a clean `/ipv4/m3u` endpoint. The app consumes this instead of raw iptv-org. Users never hit a 404 stream.

**2. Per-resolution bitrate thresholds** *(iptv-api)*
Calibrated minimum speeds worth adopting directly:
- 1280×720 → 0.2 M/s
- 1920×1080 → 0.5 M/s
- 3840×2160 → 1.0 M/s

**3. Supply mode / compensation fallback** *(iptv-api)*
If too few streams pass quality filters, re-admit borderline ones rather than showing an empty category. Good safeguard against over-aggressive filtering.

**4. Lazy RTMP relay with idle-stop** *(iptv-api)*
Proxy streams server-side on first viewer request; tear down after an idle timeout. Solves CORS issues and soft geo-blocks without a persistent relay process.

---

## EPG / Data Matching

**5. EPG name fallback chain** *(iptvnator)*
Resolve channels via `tvg-id → tvg-name → channel-name` in that order. We currently only try `tvg-id` (via `baseChannelId()`). The name fallback could meaningfully improve EPG coverage for channels with malformed or missing IDs.

**6. Multi-source EPG merge** *(iptv-api)*
Aggregate multiple XMLTV feeds into one output. Our current pipeline uses only iptv-org/epg; adding a second source (e.g. xmltv.net) would fill gaps for channels with no iptv-org guide mapping.

**7. Channel alias mapping** *(iptv-api)*
A flat file mapping spelling variants → canonical channel names. Improves match rates when the same channel appears under different names across M3U sources.

---

## UX / Navigation

**8. Number keys 0–9 select channel by index** *(iptvnator)*
Fast channel jump on TV remotes with a numpad. Could wire into our `src/lib/keys.ts` alongside existing D-pad handling.

**9. Arrow keys as seek controls** *(iptvnator)*
Left/right arrow seeks ±5s when the player has focus and no sidebar is open. Natural dual-use for TV remotes — navigate menus when overlay is up, seek when it's hidden.

**10. Sort by `viewed_at` — Most Watched** *(iptvnator)*
Extend the existing `pushRecent()` storage to count views per channel and expose a "Most Watched" sort on the Home screen. No external data needed — fully local.

---

## Architecture

**11. Progressive result writing** *(iptv-api)*
Write validated results as speed tests complete rather than waiting for a full scan. Means partial results are usable immediately — relevant if we ever run client-side stream health checks.

**12. IPv4/IPv6 auto-detect and prefer** *(iptv-api)*
Detect the viewer's network stack and serve the matching stream variant. Relevant for LG webOS and other TV devices that may be IPv6-only or have protocol preferences.

**13. Geo + ISP stream weighting** *(iptv-api)*
Weight or filter streams by proximity to the viewer. A lightweight version: detect country via IP geolocation at the edge (`/api/streams`) and prefer streams whose URL hostname resolves locally. No popularity DB needed.

**14. `mediainfo.js` for in-process stream probing** *(iptv-org/iptv)*
iptv-org's stream tester uses `mediainfo.js` (not FFmpeg) for resolution/codec detection — it runs in Node with no native binary. We could run this server-side in `/api/streams` to attach real resolution metadata to each stream URL without a sidecar.

---

## Data We're Not Using (iptv-org/database)

The database API has richer fields than what we currently consume from index.m3u:

**15. `is_nsfw` flag per channel** *(iptv-org/database)*
Direct answer to backlog #22 (family-safety filter). The database `channels.json` has `is_nsfw: true/false`. Switching from M3U to the JSON API (backlog #21) unlocks this for free.

**16. `closed` date — filter dead channels** *(iptv-org/database)*
Channels that have ceased broadcasting have a `closed` date. We currently show them. Could filter `closed` channels out entirely, or badge them as "offline".

**17. `format` per feed (1080i, 720p, etc.)** *(iptv-org/database)*
The feeds table has a `format` field with the actual broadcast format. This would replace our `parseChannelName()` quality-chip hack with authoritative data.

**18. Multiple logos per channel with SVG support** *(iptv-org/database)*
The logos table has dimensions, format (PNG/SVG/WebP/AVIF), and `in_use` flag. We could pick the best-resolution or SVG logo per channel rather than taking whatever the M3U tvg-logo gives us.

**19. `alt_names` for better search** *(iptv-org/database)*
Channels have `alt_names` (e.g. `安徽卫视;AHTV`). Indexing these would make our search find channels by their local-language name or abbreviation.

**20. Feed `broadcast_area` + `timezones`** *(iptv-org/database)*
Feeds carry `broadcast_area` (down to city level: `ct/GBLON`) and `timezones`. Could use timezone to show "primetime" relative to the channel's home timezone, or surface locally relevant channels.

---

## EPG Sources (Beyond iptv-org/epg)

**21. Free hosted XMLTV sources** *(iptv-org/awesome-iptv)*
Several free multi-country EPG feeds exist that don't require running our own grabber:
- **EPGSHARE01.online** — multi-country, free
- **open-epg.com** — free 2-day EPG sorted by country
- **IPTV-EPG.org** — free EPG with playlist editor
- **i.mjh.nz** — AU/NZ/South Africa

These could supplement or replace our GitHub Actions pipeline for getting started faster.

**22. `epg-parser` / `@iptv/xmltv` npm packages** *(freearhey, iptv-org)*
Both are proper XMLTV parsers vs our hand-rolled regex in `src/lib/epg.ts`. `epg-parser` (from the same author as iptv-org) parses the full XMLTV spec: multilingual titles, episode numbers, star ratings, content ratings (BBFC/MPAA), and crucially **programme image URLs** (poster/backdrop from tvdb/tmdb inline in the XML). `@iptv/xmltv` works in both Node and the browser.

**32. EPGTalk — free hosted EPG, no pipeline needed** *(acidjesuz/EPGTalk)*
A community-maintained service (running since 2017) that publishes ready-to-consume `.gz` XMLTV files on GitHub's raw CDN, updated nightly. Direct URLs, no auth, no rate limit:
- Combined (US+UK+Mexico, 1,104 ch): `https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/guide.xml.gz`
- US national (694 ch, 7 days): `.../US_guide.xml.gz`
- UK (536 ch, 7 days): `.../UK_guide.xml.gz`
- Latino/Mexico (608 ch, 7 days): `.../Latino_guide.xml.gz`
- US Local (434 ch, 140+ markets, 72h): `.../US_local_guide.xml.gz`

**This is the fastest path to activate EPG**: set `EPG_GUIDE_URL` to the combined URL and skip the GitHub Actions grabber pipeline entirely until we need broader coverage.

**33. Programme artwork from EPG data** *(freearhey/epg-parser)*
XMLTV programmes can embed `<image>` elements with type (poster/backdrop), and source system (tvdb/tmdb) with a direct URL. `epg-parser` extracts these into `program.image[]`. Could drive artwork in the Now Playing overlay without a separate TMDB API call — the data is already in the EPG XML when the grabber source includes it.

**34. Episode / series metadata from EPG** *(freearhey/epg-parser)*
`<episode-num system="onscreen">S01E02</episode-num>` gives series labels. `<star-rating system="IMDB"><value>8/10</value></star-rating>` gives ratings. `<previously-shown>` flags repeats. All parseable from the XMLTV without external APIs.

---

## EPG Pipeline Improvements (iptv-org/epg)

**35. `--json` flag eliminates our XMLTV regex parser** *(iptv-org/epg)*
The grabber's `--json` flag outputs `guide.json` alongside the XML — a native JS-friendly structure with all rich fields already parsed. We could consume this directly and delete `parseXmltv()` from `src/lib/epg.ts` entirely.

**36. `--maxConnections` — we're undershooting** *(iptv-org/epg)*
Default is 1 (fully sequential). At 2s/channel, 3,600 channels = ~2h. We set `--maxConnections=5`; safely going to `10–20` with `--delay=500ms` would cut the Action run to ~6min. Risk: some sites rate-limit at high concurrency.

**37. `--days=3` for multi-day lookahead** *(iptv-org/epg)*
We use `--days=2`. Bumping to 3–7 gives enough lookahead to show "Next" and "Coming up later" without re-fetching. File size grows linearly but gzip keeps it manageable.

**38. FAST channel EPG: i.mjh.nz + pluto.tv + plex.tv** *(iptv-org/epg)*
For free/FAST channels (Pluto TV, Plex, Samsung TV+, Tubi) the best sources by channel count:
- `i.mjh.nz` — 10,870 ch, most reliable for FAST
- `pluto.tv` — 2,591 ch
- `plex.tv` — 1,315 ch

Explicitly targeting these in `custom.channels.xml` improves coverage for channels most likely to be free and accessible.

**39. We're not parsing `description` or `icon` from EPG output** *(iptv-org/epg)*
Our `parseXmltv()` only extracts channel, start, stop, title. The grabber also outputs programme `description`, `icon` (thumbnail), `category`, `episodeNum`, `rating`, `image` (tvdb/tmdb poster). Surfacing even the description in the Now Playing overlay would immediately improve it with no pipeline changes.

---

## Social / Experimental

**23. Synchronized watching (Watch2Gether for IPTV)** *(IPTV-Restream / antebrl)*
A repo exists that adds synchronized viewing, restreaming, proxying, and playlist sharing. Niche but interesting for a "watch party" feature.

**24. Multi-channel split-screen viewer** *(VidGrid)*
Show multiple channels simultaneously with one-click audio switching. Interesting for sports/news use cases on a large TV.

**25. Quality-first curated subset** *(Free-TV/IPTV)*
Free-TV maintains a manually curated, HD-only, free-only list (~500 channels) with explicit SD/geo-block/YouTube badges. Could use this as a high-quality "Featured" row rather than the full iptv-org list.

---

## hls.js — Non-obvious Production Patterns

**26. Fatal error recovery by type** *(hls.js)*
Three distinct recovery paths — mixing them up causes infinite load loops:
- `MEDIA_ERROR` fatal → call `hls.recoverMediaError()` with ≥5s debounce
- `NETWORK_ERROR` fatal → **don't auto-retry** (all retries exhausted) — show UI error
- Any other fatal → call `hls.destroy()`
- Non-fatal → self-healing, ignore

We currently call `recoverMediaError()` indiscriminately — this needs fixing.

**27. `backBufferLength: 30` for long-running streams** *(hls.js)*
Default is `Infinity` — hls.js keeps all played segments in RAM forever. On a TV watched for hours this is a memory leak. Setting `backBufferLength: 30` evicts anything older than 30s. Critical for webOS.

**28. `capLevelToPlayerSize: true`** *(hls.js)*
Automatically caps ABR to the video element's rendered pixel dimensions. Prevents downloading 1080p when the element is displayed at 480p. Set once in Hls config, no code needed.

**29. `skipBufferHolePadding: 0.2` for Smart TV gap-jumping** *(hls.js)*
webOS/Tizen/Xbox have `currentTime` rounding that blocks standard buffer-gap detection. This padding makes gap-jumping more tolerant. Low-risk config addition.

**30. `hls.bandwidthEstimate` for a signal-quality indicator** *(hls.js)*
Read-only EWMA bandwidth estimate in bits/s. Poll this inside `FRAG_BUFFERED` or on a 5s interval to drive a signal-strength chip in the player overlay. No extra network calls.

**31. Correct overlay events** *(hls.js)*
- Buffering spinner: `video.waiting` (show) + `video.playing`/`canplay` (hide) — not hls events
- Quality badge: `LEVEL_SWITCHED` → `hls.levels[data.level].height` / `.bitrate`
- Live latency: poll `hls.latency` + `hls.targetLatency`
- FPS warnings: `FPS_DROP` event
