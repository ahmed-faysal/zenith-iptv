# Ideas — Triaged

Research findings from the IPTV ecosystem (iptv-org stack, iptvnator, iptv-api,
hls.js, EPGTalk, epg-parser, Free-TV), each **verified against our real
constraints**: browser + LG webOS target (no native player), iptv-org data as it
actually is, and Vercel serverless. Last verified **2026-06-21**.

**Status note (2026-06-21):** the app is deployed and EPG is **active**, so the
"deploy-gated" framing below is historical — the EPG-epic items are now actionable.

**Legend:** ✅ shipped · 🟢 viable & actionable now · 🗓️ EPG enhancements (EPG now
active) · 🅿️ parked (viable but infra-heavy / low value) · ❌ rejected (verified
dead — do not revisit).

---

## ✅ Shipped

- **hls.js tuning** — `backBufferLength:30`, `capLevelToPlayerSize:true` (Tier 1).
- **Buffering spinner** — native `waiting`/`playing` events (Tier 1).
- **channels.json enrichment** — canonical categories, reliable country, best
  logo, stream quality, via build-time `gen-channels.ts` → `enrichment.json`
  (Tier 2). Covers the old backlog #21/#23/#25, and #17/#18 (format/logo) and
  #16-data are subsumed here.
- **#26 fatal-error recovery** — `planRecovery()` + VideoPlayer: network→startLoad,
  media→recoverMediaError (≤2 each), reset on successful playback/channel change;
  fewer instant "Stream unavailable" dead-ends.
- **Automatic stream failover** — `Channel.streamUrls: string[]`; the player
  advances through a channel's URLs (cap 4) on failure, erroring only when all are
  exhausted. URLs come from iptv-org `streams.json` alternates + multi-source merge.
- **Multi-source merge** — curated registry (`sources.ts`) merged behind
  `/api/channels`: iptv-org + Free-TV/IPTV + atsushi444; identity union collects
  cross/within-source backup URLs; `http→https` upgrade; dead sources skipped.
  Subsumes #6 (channel multi-source) and the #25 "Featured row" data source.
- **EPG ("now/next")** — the dormant pipeline is now live: `EPG_GUIDE_URL` set,
  `/api/epg` serving ~2,888 channels. See the EPG-enhancements section below.
- **Deploy** — live at `zenith-iptv.vercel.app` (Vercel, production from `main`).

---

## 🟢 Viable & actionable now (in-browser, no deploy needed)

Ranked by value/effort.

1. **#19 — alt_names search.** 2,725/9,183 channels carry local-language names /
   abbreviations. Indexing them lets search find channels by their real name.
   Cost: ship `altNames` in the payload (or fold into the enrichment artifact).
2. **#10 — "Most Watched" sort.** Build from the existing `pushRecent()` history
   in [storage.ts](../src/lib/storage.ts). Fully local, no new data.
3. **#30 — Signal-quality indicator.** Poll `hls.bandwidthEstimate` (confirmed in
   1.6.16) for a small connection chip in the player overlay. No extra fetches.
4. **#8 — Number-key channel jump.** Keys 0–9 select by index on the remote;
   wire into [keys.ts](../src/lib/keys.ts). Small UX win.
5. **#16 — Hide dead channels.** Only **45** channels carry a `closed` date — low
   value but a cheap one-line filter in the enrichment merge. Optional.
6. **#25 — "Featured" row.** Free-TV/IPTV is now a merged source, so its curated
   channels are already in the catalogue; a Featured row is now just a UI surfacing
   choice (e.g. tag-by-source) rather than a new data integration. Optional.

---

## 🗓️ EPG enhancements — EPG is now active

The EPG pipeline is live (`EPG_GUIDE_URL` set; `/api/epg` serving ~2,888
channels). These now-actionable items would improve it:

- **#5 EPG name fallback** (`tvg-id → tvg-name`) for better match coverage.
- **#35 `--json` grabber output** — drop our hand-rolled XMLTV regex parser.
- **#37 `--days=3`**, **#36 `--maxConnections=10–20`** — pipeline tuning.
- **#39 parse `description`** (and #33 artwork / #34 episode meta) — *conditional*
  on the chosen guide source actually carrying those fields.
- **#6 multi-source merge / #38 FAST sources** (i.mjh.nz, pluto.tv, plex.tv) —
  widen coverage.
- **#32 EPGTalk** as a zero-pipeline guide URL — *needs validation*: its channel
  ids may not match our iptv-org tvg-ids, so coverage is unproven.
- **#22-epg `epg-parser` / `@iptv/xmltv`** — robust parser if we stay XMLTV.
- **#40 "What's on now" / match search** — search every channel's current
  programme title (e.g. `world cup`, `football`) to surface channels airing a
  live event, plus an optional "Live now" sports row. **Now viable (EPG active).**
  Verified: 193/340 (56%) of our Sports channels have an EPG guide mapping. Real
  caveats: marquee-sport free streams die fastest (the match may be *found* but
  unwatchable), and title quality is the guide source's (`football` likely hits;
  team-name search may whiff). Needs `description` parsing (#39) for best matching.

---

## 🚀 On-device (the one remaining deploy-bucket item)

- **#13 install on the LG.** Deploy (#11) and the TV app URL (#12) are done; only
  the on-device install remains — see [webos/README.md](../webos/README.md).

---

## 🅿️ Parked — viable but infra-heavy or low value here

- **#1 stream-validation sidecar / #2 bitrate thresholds / #3 supply mode /
  #11-progressive / #14 mediainfo probing** — all hang off running a stream
  checker (Docker/cron). Real, but a separate infra project; revisit if dead
  streams become the top complaint.
- **#4 lazy relay (server-side proxy)** — the *only* real fix for streams that
  need custom headers, or are CORS/geo-blocked (see ❌#24). Proxying live HLS
  through Vercel is impractical; park until there's a cheap relay host.
- **#13 geo weighting** — we now have country data and a country filter in
  Settings already; marginal extra value. Fold into the existing country filter
  if wanted.
- **#20 broadcast_area / timezones** — complex, low payoff.
- **Watch-party / split-screen multi-view** — big, niche (multi-view was already
  cut from v1).

---

## ❌ Rejected — verified dead, do not revisit

| Idea | Why it's dead (verified) |
|---|---|
| **#22 family-safety filter** | `index.m3u` has **0** `is_nsfw` channels — nothing to filter. |
| **NSFW channel toggle** | iptv-org publishes **no adult streams** (373 flagged channels, only 3 incidental streams). No source exists without an external adult playlist. |
| **#24 stream headers to hls.js** | `User-Agent`/`Referer` are **forbidden headers** — browser/webOS JS cannot set them; only a server proxy could. Just ~6% of streams carry them anyway. |
| **#29 `skipBufferHolePadding`** | Not a real hls.js option (research hallucination). Real option is `maxBufferHole`; deferred pending on-device evidence. |
| **#9 arrow-seek ±5s** | Live streams, no DVR buffer — nothing to seek. Contradicts the live-only design in [keys.ts](../src/lib/keys.ts). |
| **#12 IPv4/IPv6 prefer** | A browser can't choose IP version per-request (OS resolver does); streams are single URLs. |
| **#15 is_nsfw surfacing** | Same as #22 — no nsfw in our source. |

---

## Suggested order

**Failover, multi-source merge, EPG, and deploy are all shipped.** Next:
1. **mpegts.js fallback** (play non-HLS streams — see BACKLOG "Next up"), then
2. **#19 alt_names search** → 3. **#10 Most Watched** → 4. **install on the LG (#13)**.
#30/#8/#16/#25 and the EPG enhancements are nice-to-haves to fold in
opportunistically.
