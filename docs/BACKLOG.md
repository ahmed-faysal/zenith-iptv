# Live TV — Backlog & Known Issues

Single source of truth for outstanding work. Tackle top-down: Critical → Important
→ Minor → Future. Check items off as they ship. Each item links to the relevant
code and states the recommended fix.

Source review: post-merge holistic review on 2026-06-17.

---

## 🔴 Critical — broken features (fix first)

- [x] **1. EPG "now playing" removed for v1 (data source 404'd).** ✅ 2026-06-17
  - The old EPG URL `https://iptv-org.github.io/epg/guides/full.xml` returns **404**
    (iptv-org no longer hosts a single pre-generated guide), so the feature only
    ever rendered nothing. Removed the EPG plumbing and the now-playing UI:
    deleted `/api/epg`, `src/lib/epg-source.ts`, `src/lib/epg.ts`, the
    `EpgEntry`/`EpgProgramme` types, and the `epg.now` overlay in
    [WatchView.tsx](../src/components/WatchView.tsx). Also resolves #10.
  - Reviving EPG properly is parked as a future improvement — see **#26**.

- [x] **2. Vertical D-pad nav between rows.** ✅ 2026-06-17
  - Added [useGridFocus.ts](../src/hooks/useGridFocus.ts), a container-level hook on
    [HomeView](../src/components/HomeView.tsx) that treats the rows as a grid:
    ArrowDown/ArrowUp move focus to the **same column index** in the adjacent row
    (clamped to that row's length). Each [CategoryRow](../src/components/CategoryRow.tsx)
    is marked `data-row` and keeps its existing horizontal `useFocusNav` (different
    keys, no conflict). Covered by `__tests__/useGridFocus.test.tsx`.

- [x] **3. Initial focus on load.** ✅ 2026-06-17
  - `useGridFocus` focuses the first card as soon as channels render (the `ready`
    flag), so a remote-only TV has a starting point.
    [ChannelSidebar](../src/components/ChannelSidebar.tsx) now focuses its first
    item when it opens. Covered by `useGridFocus.test.tsx` and
    `__tests__/ChannelSidebar.test.tsx`.

---

## 🟡 Important — performance & reachability

- [x] **4. Cap big category rows.** ✅ 2026-06-17
  - [CategoryRow](../src/components/CategoryRow.tsx) takes an optional `limit`;
    [HomeView](../src/components/HomeView.tsx) caps each category row at 40 cards
    (`ROW_LIMIT`) so the ~5.8k "Other" / ~3.5k Entertainment lists no longer paint
    thousands of DOM nodes. Favorites/Continue Watching stay uncapped (small); the
    long tail lives in Search. Covered by `__tests__/CategoryRow.test.tsx`.
    (Virtualization remains an option if 40 ever feels limiting.)

- [x] **5. Search reachable from the UI.** ✅ 2026-06-17
  - New [TopBar](../src/components/TopBar.tsx) with focusable **Search** + Settings
    buttons, rendered as a `data-row` so the remote reaches it via the grid nav.
    Search routes to `/search`. Bonus: Settings is now remote-reachable too (it
    was previously a non-focusable button). Covered by `__tests__/TopBar.test.tsx`.

- [x] **6. Channel payload fetched once per session.** ✅ 2026-06-17
  - New [channels-client.ts](../src/lib/channels-client.ts) holds a session-wide
    promise cache (`loadChannels`, mirroring the server `source.ts` DI/reset
    pattern); a rejected fetch is dropped so a transient failure can retry. The
    thin [useChannels](../src/hooks/useChannels.ts) hook exposes it, and Home,
    Watch, and Search now all read through it instead of each `fetch`-ing the full
    2.67 MB list. Cache behavior covered by `__tests__/channels-client.test.ts`.

---

## 🟢 Minor — polish

- [ ] **7. Broken logos show a broken-image glyph.**
  - [ChannelCard.tsx](../src/components/ChannelCard.tsx) uses the placeholder only
    when `logo` is empty, not when the image 404s (many iptv-org logos are dead).
  - **Fix:** add an `onError` handler that swaps in the placeholder `<div>`.

- [ ] **8. Settings filter needs exact typed strings.**
  - Language/country filter expects literal "English" / "GB"
    ([SettingsPanel.tsx](../src/components/SettingsPanel.tsx)) — painful with no
    keyboard on a TV.
  - **Fix:** replace free-text inputs with pick-lists derived from the loaded
    channels' languages/countries.

- [ ] **9. Test-only cache-reset helpers exported in production.**
  - [source.ts](../src/lib/source.ts) (`__resetCache`) and now
    [channels-client.ts](../src/lib/channels-client.ts) (`__resetChannelsCache`)
    both export a test-only reset from an app module. Harmless; tidy if convenient.

- [x] **10. "Now playing" dead branch removed.** ✅ 2026-06-17
  - Removed the unused `channel.nowPlaying` render in
    [ChannelCard.tsx](../src/components/ChannelCard.tsx) and the `nowPlaying` field
    on the `Channel` type (it was never populated). Done alongside #1.

---

## 🚀 Data-source upgrade (iptv-org/api) — investigated 2026-06-17

The `iptv-org/api` repo serves structured JSON on a CDN (no key) that is richer
than the raw M3U we currently parse. All of the below sit behind the existing
`/api/channels` seam, so the frontend barely changes. Endpoints:
`https://iptv-org.github.io/api/{channels,streams,guides,logos,categories,blocklist}.json`.

- [ ] **21. Switch source from M3U parsing to `channels.json` + `streams.json`.**
  - `channels.json` (39,922) gives clean name, country, **canonical categories**,
    `is_nsfw`, website; `streams.json` (15,360) gives stream url, `quality`,
    `user_agent`, `referrer`. Join by channel id in [source.ts](../src/lib/source.ts).
  - **Benefit:** replaces keyword-guessing in [categories.ts](../src/lib/categories.ts)
    with canonical category IDs; cleaner, more reliable data model.
  - **Trade-off:** larger upstream files (≈10 MB + 3 MB) — parsed server-side and
    cached, but makes slimming the client payload (#6) more important.

- [ ] **22. Family-safety filter (high value — kids/family use).**
  - Current M3U pipeline does **zero** adult filtering. The API flags **373
    `is_nsfw` channels**, ships a **1,574-entry `blocklist.json`** (DMCA/NSFW),
    and has an explicit `xxx` category.
  - **Fix:** exclude `is_nsfw`, anything in `blocklist.json`, and the `xxx`
    category from the channel list. Depends on #21 (or load these alongside the
    M3U as a deny-list).

- [ ] **23. Better logos via `logos.json`.**
  - Dedicated, usually higher-quality artwork vs. M3U `tvg-logo`. Pairs with the
    broken-logo fallback in #7.

- [ ] **24. Send stream headers to reduce dead streams.**
  - `streams.json` exposes `user_agent` / `referrer`; some streams only play with
    these. Configure hls.js (`xhrSetup` / loader) in
    [VideoPlayer.tsx](../src/components/VideoPlayer.tsx) to send them. Likely cuts
    "Stream unavailable" cases. Depends on #21 for the header data.

- [ ] **25. Quality metadata from `streams.json`.**
  - Per-stream `quality` (e.g. "720p") lets us show/sort by quality without
    waiting for the hls manifest; complements the existing QualitySelector.

> Note: `guides.json` (channel → EPG site mapping) is the missing piece for the
> proper slim-EPG build in the EPG revival, **#26**.

---

## 🧭 Pending deploy steps (need your account/device)

- [ ] **11. Deploy to Vercel.** Run `npx vercel --prod` from the project root
  (logs into your Vercel account); copy the production URL.
- [ ] **12. Set the TV app URL.** Paste the Vercel URL into
  [webos/appinfo.json](../webos/appinfo.json) (`main` field).
- [ ] **13. Install on the LG TV.** Follow [webos/README.md](../webos/README.md):
  add placeholder icons, `ares-package webos/`, install the `.ipk` via the
  Homebrew Channel.

---

## 🔮 Future ideas (already parked in the spec)

See [Future Considerations](superpowers/specs/2026-06-16-personal-live-tv-design.md)
for full notes. Summary:

- [ ] **14. App icon / logo** — hand-crafted SVG → PNG sizes for webOS + favicon.
- [ ] **15. Catchup / TV-archive** — parse `catchup` / `catchup-source` from
  `#EXTINF` to rewind live programming where supported.
- [ ] **16. PWA install** — manifest + service worker for clean phone install.
- [ ] **17. Multi-source playlist merge** — combine/curate multiple M3U sources
  behind the existing `/api/channels` seam.
- [ ] **18. Reference parsers** — read IPTVnator / Wizju for `#EXTINF` edge cases
  our parser may miss.
- [ ] **19. Multi-view** — watch several channels at once (cut from v1).
- [ ] **20. Cloudflare Pages migration** — only if the app ever goes
  commercial/public (Vercel free tier prohibits commercial use).

- [ ] **26. Revive EPG ("now / next" program guide).** Removed in v1 (#1) because
  the old feed 404'd. To bring it back, **rebuild the data source first** — the
  old fetch-whole-file-on-demand design can't work:
  - **Sources investigated (2026-06-17):**
    - `iptv-epg.org` — real XMLTV, free, no key, same `tvg-id` convention we
      match on. **But** per-country files are huge (US alone = **504 MB**,
      ~1.08M programmes, hashed redirect URL). Fetching + parsing on demand would
      OOM/timeout a Vercel function; `.gz` transfers smaller but still
      decompresses to 504 MB. **Not viable on demand.**
    - `github.com/iptv-org/epg` — the official tool is a **generator you run**
      (npm/Docker) against a channel list to produce a slim XMLTV for only your
      channels. `guides.json` (see the data-source section) maps each channel to
      its EPG site — the missing input for this build.
  - **Approach (pick one):**
    - (a) **Self-hosted slim EPG (proper fix):** a scheduled GitHub Action/cron
      runs the iptv-org/epg generator (or pre-filters an iptv-epg.org country
      file) against our channel list, producing a small XMLTV we host; a new
      `/api/epg` reads that slim file. Real mini-feature — needs its own spec.
    - (b) **Per-channel EPG API (research first):** if a service like `epg.pw`
      returns one channel's guide in a small response, that fits an on-demand
      model with minimal change. Verify availability/format before committing.
  - When revived, re-add the `epg.now` overlay in
    [WatchView.tsx](../src/components/WatchView.tsx); optionally re-introduce
    `nowPlaying` on cards (#10) only if EPG is joined into the channel list.
