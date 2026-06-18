# Live TV — Backlog & Known Issues

Single source of truth for outstanding work. Tackle top-down: Critical → Important
→ Minor → Future. Check items off as they ship. Each item links to the relevant
code and states the recommended fix.

Source review: post-merge holistic review on 2026-06-17.

---

## ✅ Fixed during local testing (2026-06-17)

- [x] **Duplicate React keys / duplicate & hidden channels.** The console flagged
  repeated keys (e.g. `576p`, `21-jump-street`). Two root causes in
  [m3u.ts](../src/lib/m3u.ts): (1) `slug()` kept only ASCII, so non-Latin (CJK)
  names collapsed to a stray quality tag or empty string — now Unicode-aware
  (`\p{L}\p{N}`), recovering ~200 distinct channels; (2) iptv-org lists some
  channels multiple times — `parseM3U` now de-dupes by id (keeps first). Verified
  against the live feed: 10,985 channels, zero duplicate ids. Covered by
  `__tests__/m3u.test.ts`.

---

## 🔴 Critical — broken features (fix first)

- [x] **27. Back button does nothing on LG webOS (keyCode 461 not handled).** ✅ 2026-06-17
  - webOS fires the Magic Remote Back button as `keyCode 461` (`0x1CD`), not
    `"Escape"`. The old Back handlers only checked `"Escape"`/`"Backspace"`.
  - **Done:** new shared [keys.ts](../src/lib/keys.ts) `isBackKey(e)` matches
    `Escape`, `GoBack`, and `keyCode 461`; wired into
    [SearchView](../src/components/SearchView.tsx), [WatchView](../src/components/WatchView.tsx),
    [SettingsPanel](../src/components/SettingsPanel.tsx), and
    [ChannelSidebar](../src/components/ChannelSidebar.tsx). Covered by
    `__tests__/keys.test.ts`.

- [x] **28. Player controls now D-pad reachable; favorite no longer needs an
  `F` key.** ✅ 2026-06-17
  - **Done:** new [ControlBar](../src/components/ControlBar.tsx) — a `data-row`
    with focusable **★ Favorite** and **☰ Channels** buttons (activate on OK/Enter)
    — overlays the Player. [WatchView](../src/components/WatchView.tsx) now runs
    `useGridFocus`, so the control strip gets initial focus and ArrowDown reaches
    the quality picker. The `F`-key and the global ArrowLeft/Right sidebar toggle
    are gone; the sidebar opens via the Channels button. Favorite is derived from
    storage (no setState-in-effect). Covered by `__tests__/ControlBar.test.tsx`.
  - Bonus fix: OK/Enter on action buttons fired both `onKeyDown` and the native
    click (favorite would toggle twice) — handlers now `preventDefault()` the
    duplicate click across ChannelCard/ControlBar/ChannelSidebar.

- [ ] **28. Player controls unreachable by D-pad — favorite needs a non-existent
  `F` key.** The app's stated promise is "driven entirely by a TV remote's D-pad"
  (README), but on the Player screen:
  - The **favorite** toggle ([WatchView.tsx:50](../src/components/WatchView.tsx))
    is only triggered by `onClick` or pressing **`F`** — there is no `F` key on a
    TV remote. The star button is not `data-focusable` and [WatchView](../src/components/WatchView.tsx)
    has no `useGridFocus`/`useFocusNav`, so the D-pad can never land on it.
  - The **QualitySelector** ([VideoPlayer.tsx:53](../src/components/VideoPlayer.tsx))
    is likewise unreachable: WatchView's window listener makes **ArrowLeft/Right
    always drive the sidebar**, so even a focused quality button can't be moved
    between. Both controls only work in Magic Remote **pointer mode**.
  - **Fix:** give the Player real D-pad focus management (e.g. an overlay control
    strip with `data-focusable` favorite + quality buttons, navigated with
    `useFocusNav`), and bind favorite to **OK/Enter on a focusable button**, not
    the `F` key. Remove the `F`-key control from the README once done (or keep it
    only as a desktop convenience).



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

- [x] **35. Player overlay polish — auto-hide, collapse quality, de-dupe.** ✅ 2026-06-18
  - Feedback from a real screenshot: the overlay never hid, and **quality + LIVE
    were each shown twice** (a top quality pill *and* an always-on `Auto 288p…`
    row; a top LIVE badge *and* a bottom one).
  - **Done:** the overlay now **auto-hides after ~3.5s idle** with a graceful
    fade ([WatchView](../src/components/WatchView.tsx)) — stays shown while paused
    or while the sidebar is open; any activity reveals it, and the first key while
    hidden is swallowed (reveals without triggering a control). D-pad grid nav is
    suspended while hidden. **Quality** collapsed into one button that opens an
    options popover ([PlayerOverlay](../src/components/PlayerOverlay.tsx)); the
    always-visible row and the duplicate **LIVE** indicator are gone. Covered by
    updated `PlayerOverlay.test.tsx`.
  - Note: the large on-screen text some channels show (e.g. a programme title) is
    the **broadcaster's own graphics/captions in the video**, not our overlay.

- [x] **34. Player UI redesign — glassy streaming-player overlay.** ✅ 2026-06-18
  - Reworked the player chrome to match a modern streaming-player look (from a v0
    mockup) while staying honest for live, no-DVR streams. New
    [PlayerOverlay](../src/components/PlayerOverlay.tsx): a **top bar** (Back, LIVE
    badge, channel name + category, `HD · <res>` quality pill, live
    [Clock](../src/components/Clock.tsx)), a **center play/pause**, and a **bottom
    row** (favorite, channels, volume slider + mute, fullscreen) plus a **● LIVE**
    indicator. Each band is a `data-row` so `useGridFocus` walks between them.
  - **Deliberately omitted** the mockup's scrubber / ±30s / skip (no live seek),
    viewer count (no data), and cast (not implemented) — they'd be dead controls.
  - **New dual-target controls:** volume slider + mute (real in browser; TVs use
    the hardware remote) and fullscreen (real `requestFullscreen` in browser).
  - HLS level state lifted from VideoPlayer into [WatchView](../src/components/WatchView.tsx)
    so the quality pill + picker share one source of truth;
    [VideoPlayer](../src/components/VideoPlayer.tsx) is now a pure playback surface
    driven by `paused`/`volume`/`muted`/`currentLevel` props. The old `ControlBar`
    is replaced. Covered by `player.test.ts` and `PlayerOverlay.test.tsx`.

- [x] **33. Player media controls (play/pause + remote transport keys).** ✅ 2026-06-17
  - The player had no transport controls and ignored the remote's hardware media
    buttons entirely. **Done:** [ControlBar](../src/components/ControlBar.tsx) now
    leads with a focusable **Play/Pause** button (also the player's initial focus);
    [VideoPlayer](../src/components/VideoPlayer.tsx) takes a `paused` prop and
    applies it (resume lets hls.js catch back up to the live edge). New
    [keys.ts](../src/lib/keys.ts) `mediaAction()` maps the remote's Play (415),
    Pause (19), Play/Pause (10252/179) and Stop (413) keys — handled in
    [WatchView](../src/components/WatchView.tsx) (Stop → Home). Switching channels
    resumes playback. Seek/FF/RW deliberately omitted — not meaningful for live
    (see catchup, #15). Covered by `keys.test.ts` and `ControlBar.test.tsx`.

- [x] **29. Modals close on Back/Escape and restore focus.** ✅ 2026-06-17
  - **Done:** [SettingsPanel](../src/components/SettingsPanel.tsx) now closes on
    Back (window `isBackKey` listener) and restores focus to its opener on
    unmount. [ChannelSidebar](../src/components/ChannelSidebar.tsx) closes on Back
    (with `stopPropagation` so it doesn't also fire the Player's Home navigation)
    and captures/restores opener focus on open/close. The Player's Back also
    closes the sidebar first, then returns Home. Covered by updated
    `SettingsPanel.test.tsx` and `ChannelSidebar.test.tsx`.

- [x] **30. Focus is now unmistakable on native form controls.** ✅ 2026-06-17
  - **Done:** added a global rule in [globals.css](../src/app/globals.css) —
    `[data-focusable]:focus` / `:focus-visible` paint a high-contrast 3px white
    outline (and a softer outline on `:hover` for Magic Remote pointer mode).
    Checkboxes are enlarged to 22px with `accent-color`, so the focused checkbox
    row, Save/Cancel buttons, and quality options are legible from a sofa.
    `-webkit-` prefix kept for older webOS Chromium.

- [x] **4. Cap big category rows.** ✅ 2026-06-17
  - [CategoryRow](../src/components/CategoryRow.tsx) takes an optional `limit`;
    [HomeView](../src/components/HomeView.tsx) caps each category row at 40 cards
    (`ROW_LIMIT`) so the ~5.8k "Other" / ~3.5k Entertainment lists no longer paint
    thousands of DOM nodes. Favorites/Continue Watching stay uncapped (small); the
    long tail lives in Search. Covered by `__tests__/CategoryRow.test.tsx`.
    (Virtualization remains an option if 40 ever feels limiting.)

- [x] **5. Search reachable — and fully remote-navigable.** ✅ 2026-06-17
  - New [TopBar](../src/components/TopBar.tsx) with focusable **Search** + Settings
    buttons, rendered as a `data-row` so the remote reaches it via the grid nav.
    Search routes to `/search`. Bonus: Settings is now remote-reachable too (it
    was previously a non-focusable button). Covered by `__tests__/TopBar.test.tsx`.
  - Review follow-up (2026-06-17): the search page itself is now remote-complete —
    [SearchView](../src/components/SearchView.tsx) bridges input↕results (ArrowDown
    into results, ArrowUp back to the box) and Back/Escape returns Home (Backspace
    still edits the query while typing). Closes the dead-end the TopBar link
    exposed.

- [x] **6. Channel payload fetched once per session.** ✅ 2026-06-17
  - New [channels-client.ts](../src/lib/channels-client.ts) holds a session-wide
    promise cache (`loadChannels`); a rejected fetch is dropped so a transient
    failure can retry. The
    thin [useChannels](../src/hooks/useChannels.ts) hook exposes it, and Home,
    Watch, and Search now all read through it instead of each `fetch`-ing the full
    2.67 MB list. Cache behavior covered by `__tests__/channels-client.test.ts`.

---

## 🟢 Minor — polish

- [x] **31. QualitySelector is now a real focusable row; pointer hover cue added.**
  ✅ 2026-06-17
  - **Done:** [QualitySelector](../src/components/QualitySelector.tsx) is a
    `data-row` with `useFocusNav` and `data-focusable` buttons (reachable via the
    Player grid nav from #28); the global `:hover` outline from #30 gives Magic
    Remote pointer-mode users feedback before clicking. Covered by updated
    `QualitySelector.test.tsx`.

- [ ] **32. OLED burn-in: static bright chrome in fixed positions.** The `Live TV`
  `<h1>`, row titles, and [TopBar](../src/components/TopBar.tsx) buttons sit in the
  exact same screen position every session. On the target LG C3 OLED this is a
  (low) burn-in risk. Low urgency — the dark theme already mitigates it, and the
  new Player [ControlBar](../src/components/ControlBar.tsx) uses translucent dark
  backgrounds per the guideline. Remaining: keep Home chrome low-luminance and
  avoid bright fixed badges/logos; revisit if an always-on HUD is added. Left open
  as a design watch-item, not a discrete fix.

- [x] **7. Broken logos fall back to the placeholder.** ✅ 2026-06-17
  - [ChannelCard.tsx](../src/components/ChannelCard.tsx) now tracks a `broken`
    state and renders the placeholder `<div>` when `logo` is empty **or** the
    `<img>` fires `onError` (many iptv-org logos are dead). Covered by
    `__tests__/ChannelCard.test.tsx`.

- [x] **8. Settings uses pick-lists, not typed strings.** ✅ 2026-06-17
  - [SettingsPanel.tsx](../src/components/SettingsPanel.tsx) now renders focusable
    checkbox pick-lists for languages/countries, pre-checked from saved prefs — no
    typing needed on a remote. The panel has vertical `useFocusNav` and focuses its
    first control on open. Covered by `__tests__/SettingsPanel.test.tsx`.
  - Review follow-ups (2026-06-17): (a) the lists are the **most-common 24** values
    by channel count (frequency-sorted via [topValues](../src/lib/filters.ts),
    `__tests__/filters.test.ts`) so they stay short enough to reach **Save** with a
    remote; (b) checkboxes now toggle on **Enter** as well as Space, since a TV
    remote's OK button sends Enter — without this, filters couldn't be changed by
    remote at all.

- [x] **9. Test-only cache-reset exports removed (factory pattern).** ✅ 2026-06-17
  - [source.ts](../src/lib/source.ts) and [channels-client.ts](../src/lib/channels-client.ts)
    now expose `createChannelSource` / `createChannelLoader` factories (each owns a
    private cache) plus a production singleton (`getChannels` / `loadChannels`).
    Tests construct an isolated instance per case, so the `__resetCache` /
    `__resetChannelsCache` hooks are gone from the app modules.

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

- [~] **26. Revive EPG ("now / next" program guide).** **Implemented on branch
  `feat/epg-revival`** (spec: [2026-06-18-epg-revival.md](superpowers/specs/2026-06-18-epg-revival.md)).
  Slim guide pre-built in CI (`.github/workflows/epg.yml` + `scripts/build-epg-channels.ts`),
  served by `/api/epg`, shown as "Now · …" in WatchView. **Dormant until** a repo
  remote exists, the Action publishes the `epg` branch once, and `EPG_GUIDE_URL`
  is set. Verified coverage: ~3,605 mapped channels once ids are matched on the
  **base xmltv_id** (our ids carry an `@feed` suffix; the naive join gave ~1).
  Country scoping is inert until the channels.json upgrade (#21) adds country data.
  Removed in v1 (#1) because the old feed 404'd; the old fetch-whole-file-on-demand
  design can't work:
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
  - **Follow-up research (2026-06-18) — option (b) ruled out, (a) confirmed:**
    - **No free, no-key, per-channel JSON EPG API exists** that keys on our
      `tvg-id`s. Checked: `epg.pw` serves **bulk only** (all / `epg_lite` /
      per-country XMLTV — no single-channel endpoint, no JSON); `epg.best`
      (iptv-epg) has a REST/JSON API but requires **OAuth2** (key);
      `Tvheadend`'s "mode=now" JSON API is a **self-hosted PVR server** that
      itself needs EPG fed in (circular); `TVmaze` is free JSON but **show
      metadata, not linear now/next** and won't map to arbitrary IPTV channels.
      → On-demand per-channel fetch is not achievable from free sources.
    - **`github.com/iptv-org/epg` is generator-only (confirmed current):** run
      via npm/Docker, **no hosted feed**. Its `--channels <custom.xml>` flag is
      purpose-built to scope output to *only our channels*, producing a single
      slim `guide.xml` (`--gzip`, `--json` variants). `GUIDES.md` lists a few
      tiny community-hosted servers (e.g. 2-channel render.com workers) — not
      usable. Channel→site mapping for the custom XML comes from the API's
      `guides.json` (see data-source section).
  - **Recommended design (option a):** a scheduled **GitHub Action** (cron,
    ~6–12h) builds a `<channel site site_id xmltv_id>` list from `guides.json`
    filtered to the channels we surface (scope by enabled country/category to
    keep it small — most of the 40k channels have no guide anyway), runs the
    iptv-org/epg grabber against it, and publishes a slim `guide.xml(.gz)` +
    JSON (committed to an `epg` branch / release asset / gh-pages). A new
    `/api/epg` fetches that small file, parses XMLTV → a `now/next` map keyed by
    `tvg-id`, and caches server-side (~1h). It's a self-contained mini-feature
    (CI job + channels-builder script + XMLTV parser + `/api/epg`) — **needs its
    own spec before building.**
  - When revived, re-add the `epg.now` overlay in
    [WatchView.tsx](../src/components/WatchView.tsx); optionally re-introduce
    `nowPlaying` on cards (#10) only if EPG is joined into the channel list.
