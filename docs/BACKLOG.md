# Live TV — Backlog & Known Issues

Single source of truth for outstanding work. Tackle top-down: Critical → Important
→ Minor → Future. Check items off as they ship. Each item links to the relevant
code and states the recommended fix.

Source review: post-merge holistic review on 2026-06-17.

---

## 🔴 Critical — broken features (fix first)

- [ ] **1. EPG "now playing" never works — data source 404s.**
  - The EPG URL `https://iptv-org.github.io/epg/guides/full.xml` returns **404**.
    iptv-org no longer hosts a single pre-generated guide; their EPG project is a
    generator you self-host. So [epg-source.ts](../src/lib/epg-source.ts)'s fetch
    always throws, [api/epg/route.ts](../src/app/api/epg/route.ts) always returns
    `{}`, and the player overlay never shows program info.
  - **Sources investigated (2026-06-17):**
    - `iptv-epg.org` — serves real XMLTV, free, no key, and uses the same
      `tvg-id` channel-id convention we match on. **But** files are per-country
      and huge (US alone = **504 MB**, ~1.08M programmes, served via a hashed
      redirect URL). Fetching + regex-parsing on-demand would OOM/timeout a
      Vercel serverless function (especially Hobby tier). The `.gz` transfers
      smaller but still decompresses to 504 MB to parse. **Not viable for the
      current fetch-whole-file-on-demand design.**
    - `github.com/iptv-org/epg` — the official tool is a **generator you run**
      (npm/Docker) against a channel list to produce a slim XMLTV for only your
      channels. No giant static feed to fetch.
  - **Fix (pick one):**
    - (a) **Remove EPG for v1** — delete `/api/epg`, `epg-source.ts`, `epg.ts`,
      and the `epg.now` usage in [WatchView.tsx](../src/components/WatchView.tsx).
      Honest and clean; revisit later. (Also resolves #10.)
    - (b) **Self-hosted slim EPG (proper fix, needs its own spec):** a scheduled
      GitHub Action/cron runs the iptv-org/epg generator (or pre-filters an
      iptv-epg.org country file) against our channel list, producing a small
      XMLTV we host; `/api/epg` reads that slim file. Real mini-feature.
    - (c) **Per-channel EPG API (research first):** if a service like `epg.pw`
      returns a single channel's guide in a small response, that fits our
      on-demand model with minimal change. Verify availability/format before
      committing.
  - **Decision needed:** (a) remove now, or schedule (b)/(c) as a follow-up spec.

- [ ] **2. TV remote can't move between rows — vertical D-pad nav missing.**
  - Each [CategoryRow](../src/components/CategoryRow.tsx) handles only horizontal
    arrows. Nothing coordinates up/down between rows on
    [HomeView](../src/components/HomeView.tsx). On the LG remote you can move
    within the first row but can't reach Sports/Entertainment/etc. Tab isn't on a
    TV remote.
  - **Fix:** add vertical row-to-row focus navigation (e.g. ArrowDown/ArrowUp
    moves focus to the nearest card in the adjacent row), or a grid-aware focus
    manager spanning all rows.

- [ ] **3. No initial focus on load — cold app is dead to a remote.**
  - On Home nothing is focused at mount, so [useFocusNav.ts:21](../src/hooks/useFocusNav.ts#L21)
    returns early (`idx === -1`) and arrow keys do nothing until a card is
    clicked. Remote-only TVs have no way to start.
  - **Fix:** focus the first card on Home after channels load; focus the first
    sidebar item when the player sidebar opens
    ([ChannelSidebar.tsx](../src/components/ChannelSidebar.tsx) /
    [WatchView.tsx](../src/components/WatchView.tsx)).

---

## 🟡 Important — performance & reachability

- [ ] **4. Renders all ~11,000 channels as DOM nodes.**
  - "Other" is ~5,784 cards, Entertainment ~3,521; [HomeView.tsx:55](../src/components/HomeView.tsx#L55)
    maps the full filtered list per row. Brutal on a TV browser (slow paint,
    janky scroll).
  - **Fix:** cap each row (e.g. first 30–40 cards) and rely on Search for the
    long tail; or virtualize the rows.

- [ ] **5. Search is unreachable from the UI.**
  - `/search` exists but Home has no link/button to it (the spec's "search icon
    in the top bar" was never wired). Only reachable by typing the URL.
  - **Fix:** add a search affordance (focusable button/icon) to Home that routes
    to `/search`.

- [ ] **6. 2.67 MB channel payload re-downloaded on every navigation.**
  - Home, Player, and Search each independently `fetch("/api/channels")` and pull
    the full list. Server cache spares the origin, but the client redownloads
    2.67 MB each time.
  - **Fix:** share one client-side cache (React context, or SWR/React Query) so
    the list is fetched once per session.

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

- [ ] **9. `__resetCache` exported in production.**
  - [source.ts:10](../src/lib/source.ts#L10) — test-only helper exported from the
    app module. Harmless; tidy if convenient.

- [ ] **10. "Now playing" on channel cards is a dead branch.**
  - [ChannelCard.tsx](../src/components/ChannelCard.tsx) renders `channel.nowPlaying`,
    but the channels API never populates it (joining EPG to all 11k channels is
    out of scope). Tied to issue #1's EPG decision.
  - **Fix:** remove the dead branch (and the `nowPlaying` field) unless EPG is
    revived and joined into the channel list.

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
> proper slim-EPG build in option (b) of issue **#1**.

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
