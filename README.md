# Zenith

A personal live-TV (IPTV) app for the browser and the living-room TV. It serves a
**locally validated** channel list — every channel is play-tested before it ships,
so a tile you pick actually plays — streams HLS with
[hls.js](https://github.com/video-dev/hls.js), and is built to be driven entirely
by a TV remote's D-pad — no mouse or keyboard required.

> Personal/non-commercial use. Streams come from the public iptv-org playlist;
> this project doesn't host or rebroadcast any content.

## Features

- **Home** (`/`) — Favorites, Continue Watching, and per-category rows (News,
  Sports, Entertainment, Music, Kids, Other), navigable as a grid with the D-pad.
  Each capped row has a **See all ›** link to its full category page.
- **Category page** (`/category/<name>`) — a single category as a vertical,
  wrapping grid (instead of one side-scrolling row), with a **Show more** button
  to page through long lists. Reachable from the top-bar tabs or **See all ›**.
- **Player** (`/watch/<id>`) — full-screen HLS playback with a glassy overlay
  that auto-hides when idle: a top metadata bar (Back, LIVE badge, channel name,
  quality button, clock), a center play/pause, and a bottom control row (favorite,
  volume/mute, fullscreen). No scrubber — the streams are live. **Back** returns
  to wherever you came from (history-aware), so leaving a channel opened from
  Sports lands you back on the Sports page.
  - **Automatic source failover** — many channels publish more than one stream;
    when one is dead the player silently tries the next ("Trying another source…")
    before showing "Stream unavailable", so a dead primary no longer dead-ends a
    channel that has a working backup.
  - **Now playing (EPG)** — when guide data is available the subtitle shows
    "Now · <programme>" for the current show.
- **Channels** — a **curated, play-tested catalogue** (610 channels) served
  behind one `/api/channels` seam. Candidates are merged from several public M3U
  sources (iptv-org + Free-TV + others — add one in a line in
  [`src/lib/sources.ts`](src/lib/sources.ts)), then filtered by
  [`npm run validate`](#validating-the-catalogue) so only streams that genuinely
  play are shipped. The same channel found in multiple sources contributes
  backup URLs to the failover.
- **Search** (`/search`) — live name search over the full catalogue, fully
  remote-navigable.
- **Settings** — slide-in sidebar to filter the catalogue by language/country
  using checkbox pick-lists (no typing needed on a remote); countries show full
  names.
- **Remote-first** — initial focus on load, row-to-row and 2-axis grid D-pad
  navigation, and Back/OK handling throughout.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19, TypeScript
- [hls.js](https://github.com/video-dev/hls.js) for adaptive streaming
- [Vitest](https://vitest.dev) + Testing Library
- Packaged for LG webOS as a hosted-app wrapper (see [`webos/`](webos/))

## Getting started

Prerequisites: **Node 20+** and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Channels come from the
committed `src/data/curated.json`; if that file is ever empty the app falls back
to fetching and merging the live playlists (cached server-side for an hour), so
it never starts up blank.

### Controls (keyboard ≈ TV remote)

| Key | Action |
| --- | --- |
| Arrow keys | Move focus (D-pad) — within a row, between rows, and across the category grid |
| Enter | OK / select the focused item |
| Backspace / Escape / Back | Back — closes the open panel, else goes back in history (the LG remote's Back button, keyCode 461, is handled too) |
| ↓ / ↑ (Search) | Move between the search box and the results |

In the **Player**, the overlay (Back, Play/Pause, Favorite ★, volume/mute,
fullscreen, and the quality picker when a stream offers multiple renditions) is
fully D-pad navigable — no mouse, pointer, or physical letter keys required. The
remote's hardware **Play / Pause / Stop** buttons work too. The volume slider and
fullscreen button are mainly for the desktop browser; on a TV the hardware remote
handles volume and the app is already full-screen. Seeking is omitted since the
streams are live.

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # serve the production build
npm test         # run the test suite (vitest)
npm run test:watch
npm run lint     # eslint
npm run validate # re-validate the channel catalogue (see below)
```

## Validating the catalogue

Free public M3U sources are mostly dead: of 3,980 merged candidates, 2,937 answer
an HTTP probe but only **610 actually play** in a browser. `npm run validate`
measures that directly rather than guessing — a fast HTTP probe, then a headless
hls.js play-test over a `file://` origin (opaque, exactly like the packaged webOS
app) — and writes the survivors to `src/data/curated.json`.

**Run it on your home network.** Geo-blocking and CORS both depend on where the
request comes from, so results from a cloud runner would be wrong for the TV.
That's deliberate; see the rejected "validation in CI" entry in
[docs/IDEAS.md](docs/IDEAS.md).

```bash
npm run validate -- --limit 50   # ~90s smoke run
npm run validate                 # full pass (~110 min), resumable
npm run validate -- --fresh      # discard the checkpoint, re-test everything
```

A full pass checkpoints to `.validate-checkpoint.json` (gitignored) and flushes
periodically, so Ctrl-C or a crash costs at most the last few channels — re-run
to resume. Commit `src/data/curated.json` when you're happy with the result; a
*partial* run produces a valid but short catalogue, which ships as-is.

## Project structure

```
src/
  app/                 # routes: / (home), /category/[slug], /search,
                       #         /watch/[id], /api/channels, /api/epg
  components/          # BrowseView, CategoryPage/Row, ChannelCard, player, …
  hooks/               # focus navigation (useGridFocus/useGridNav/useFocusNav)
                       #   + shared channel cache
  lib/                 # M3U parse, source registry + merge, enrichment,
                       #   EPG source/parse, storage, types
  data/                # build-time enrichment.json (categories/logos/quality/urls)
__tests__/             # unit tests (components, hooks, lib)
scripts/               # enrichment + EPG channel-list generators
webos/                 # LG webOS hosted-app wrapper + packaging notes
docs/BACKLOG.md        # single source of truth for outstanding work
```

Multiple public M3U sources ([`sources.ts`](src/lib/sources.ts)) are fetched in
parallel, merged ([`merge.ts`](src/lib/merge.ts)) and enriched, then served behind
a single [`/api/channels`](src/app/api/channels/route.ts) seam, so adding or
swapping a source doesn't ripple into the UI. Program data ("now/next") is served
separately by [`/api/epg`](src/app/api/epg/route.ts).

## Status & roadmap

Live in production at [zenith-iptv.vercel.app](https://zenith-iptv.vercel.app):
610 validated channels (189 KB, ~0.24s), automatic stream failover, and the EPG
("now/next") guide showing a current programme on ~40% of channels. Remaining
work — the LG TV install, better categorisation (46% of channels land in
"Other"), and growing the catalogue with higher-reliability sources — is tracked
in [docs/BACKLOG.md](docs/BACKLOG.md); webOS packaging/install steps live in
[webos/README.md](webos/README.md).
