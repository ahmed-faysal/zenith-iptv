# Live TV

A personal live-TV (IPTV) app for the browser and the living-room TV. It pulls a
free channel list from [iptv-org](https://github.com/iptv-org/iptv), plays HLS
streams with [hls.js](https://github.com/video-dev/hls.js), and is built to be
driven entirely by a TV remote's D-pad — no mouse or keyboard required.

> Personal/non-commercial use. Streams come from the public iptv-org playlist;
> this project doesn't host or rebroadcast any content.

## Features

- **Home** — Favorites, Continue Watching, and per-category rows (News, Sports,
  Entertainment, Music, Kids, Other), navigable as a grid with the D-pad.
- **Player** — full-screen HLS playback with a glassy overlay: a top metadata
  bar (Back, LIVE badge, channel name, quality pill, clock), a center play/pause,
  and a bottom control row (favorite, channels, volume/mute, fullscreen, quality).
  No scrubber — the streams are live.
- **Search** — live name search over the full catalogue, fully remote-navigable.
- **Settings** — filter the catalogue by language/country using checkbox
  pick-lists (no typing needed on a remote).
- **Remote-first** — initial focus on load, row-to-row D-pad navigation, and
  Back/OK handling throughout.

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

Open [http://localhost:3000](http://localhost:3000). The first load fetches and
parses the iptv-org playlist (cached server-side for an hour), so give it a
moment to populate.

### Controls (keyboard ≈ TV remote)

| Key | Action |
| --- | --- |
| Arrow keys | Move focus (D-pad) — within a row and between rows |
| Enter | OK / select the focused item |
| Backspace / Escape / Back | Back — closes the open panel, else returns Home (the LG remote's Back button, keyCode 461, is handled too) |
| ↓ / ↑ (Search) | Move between the search box and the results |

In the **Player**, the overlay (Back, Play/Pause, Favorite ★, ☰ Channels,
volume/mute, fullscreen, and the quality picker when a stream offers multiple
renditions) is fully D-pad navigable — no mouse, pointer, or physical letter keys
required. The remote's hardware **Play / Pause / Stop** buttons work too (Stop
returns Home). The volume slider and fullscreen button are mainly for the desktop
browser; on a TV the hardware remote handles volume and the app is already
full-screen. Seeking is omitted since the streams are live.

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # serve the production build
npm test         # run the test suite (vitest)
npm run test:watch
npm run lint     # eslint
```

## Project structure

```
src/
  app/                 # routes: / (Home), /search, /watch/[id], /api/channels
  components/          # HomeView, WatchView, SearchView, player, rows, cards…
  hooks/               # focus navigation + shared channel cache
  lib/                 # M3U parsing, channel source, storage, filters, types
__tests__/             # unit tests (components, hooks, lib)
webos/                 # LG webOS hosted-app wrapper + packaging notes
docs/BACKLOG.md        # single source of truth for outstanding work
```

The channel list is parsed from the iptv-org M3U and served behind a single
[`/api/channels`](src/app/api/channels/route.ts) seam, so swapping or enriching
the data source later doesn't ripple into the UI.

## Status & roadmap

The Critical, Important, and Minor work is complete. Remaining items — Vercel
deploy, the LG TV install, the iptv-org/api data upgrade (incl. a family-safety
filter), and reviving the program guide (EPG) — are tracked in
[docs/BACKLOG.md](docs/BACKLOG.md). webOS packaging/install steps live in
[webos/README.md](webos/README.md).
