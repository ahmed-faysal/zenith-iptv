# Personal Live TV — Design Spec

**Date:** 2026-06-16
**Status:** Approved design, pending implementation plan

## Overview

A personal live TV web app for the user and their family/friends. Streams free,
publicly available live channels (news, sports, entertainment, music, kids)
sourced from the open-source iptv-org project. Deployed to Vercel's free tier.
Accessible from any browser (desktop, phone) and installable on an LG OLED smart
TV via the webOS Homebrew Channel.

## Goals

- Watch a curated mix of free live TV in the browser
- Rich, TV-friendly UI: category rows + "now playing" guide info
- Usable on an LG OLED TV with remote-control (D-pad) navigation
- Zero ongoing cost (Vercel free tier, no database, no paid APIs)
- Family/friends scale — not a public commercial service

## Non-Goals

- No user accounts / multi-tenant auth (optional single password gate only)
- No DVR, recording, or catch-up/VOD
- No full EPG time-grid (only "now/next" per channel)
- No commercial/public distribution (Vercel free tier prohibits commercial use)

## Content Source

**Primary:** [iptv-org](https://github.com/iptv-org/iptv) — open-source M3U
playlists of publicly available live streams. No API key or account required.
Thousands of global channels across all desired categories.

**EPG:** [iptv-org/epg](https://github.com/iptv-org/epg) — XMLTV program guide
data. Coverage is partial; the UI degrades gracefully when a channel has no EPG.

**Alternatives considered and rejected:**
- *Pluto TV unofficial scrapers* — fragile (JWT tokens expire ~24h) and under
  active legal takedown pressure (Warner Bros, 2024). Not durable.
- *Official FAST services (Plex, Tubi, Roku Channel)* — no public API for
  embedding into a third-party site.
- *YouTube Live API* — limited to whatever is publicly live; narrow variety.

**Design safeguard:** the channel-source layer is isolated behind the
`/api/channels` route so additional or alternate M3U sources can be added later
without touching the frontend.

## Architecture

```
iptv-org (M3U playlist + EPG XML, GitHub CDN)
        │
        ▼
Next.js API Routes (Vercel serverless, in-memory cache)
   /api/channels   — fetch + parse + group, cached 1hr
   /api/epg        — now/next programme, cached 30min
        │
        ▼
Next.js Frontend (React, dark OLED-friendly UI, D-pad navigation)
   /                — Favorites + Continue-watching + category rows
   /watch/[id]      — hls.js player, overlay, quality selector,
                      channel sidebar, dead-stream handling
   /search          — filter by name
   Settings         — language/country filter (localStorage)
        │
        ├── Browser (desktop, phone)
        └── LG OLED TV (Homebrew Channel → IPK wrapper → Vercel URL, fullscreen)

State: localStorage only (favorites, recents, last channel, filter prefs)
No database. No auth (optional password env var).
```

### Why video bandwidth is not a hosting concern

HLS streams flow **directly** from iptv-org's source servers to the viewer's
browser. They do **not** proxy through Vercel. The host only serves the app
shell and small JSON payloads (channel list, EPG) — kilobytes per visit. Vercel's
100GB/month bandwidth cap is therefore never approached.

## Stack

- **Framework:** Next.js (App Router), TypeScript
- **Video:** `hls.js` for HLS playback in the browser
- **Hosting:** Vercel free (Hobby) tier
- **State:** browser `localStorage` only — no database
- **TV packaging:** webOS hosted-app IPK wrapper pointing at the Vercel URL

## Pages & Components

### Pages

**`/` — Home**
- Dark background (OLED-friendly, reduces burn-in)
- Top bar: logo, search icon, clock
- "Continue watching" prompt for the last-watched channel
- "Favorites" row (from localStorage), then category rows: News, Sports,
  Entertainment, Music, Kids, Other
- Each row: horizontally scrollable channel cards
- D-pad: left/right within a row, up/down between rows

**`/watch/[channelId]` — Player**
- Fullscreen HLS video via `hls.js`
- Auto-hiding overlay (fades after ~3s, returns on any keypress): channel name,
  now-playing from EPG, quality selector
- Quality selector: reads `hls.levels`; shows **Auto / 1080p / 720p / 480p**
  only when the stream has multiple renditions; hidden for single-bitrate
  streams. Defaults to Auto.
- Channel sidebar (toggle with left arrow) to switch channels without leaving
- Dead-stream handling: on `hls.js` fatal error, show "Stream unavailable — try
  another" state; show a loading spinner during buffering
- D-pad: left opens sidebar, right closes, up/down navigates sidebar, Back
  returns home

**`/search` — Search**
- Filter channels by name
- Works with on-screen or connected keyboard on TV

**Settings** (panel/modal)
- Language and country filter to tame the large global playlist
- Persisted to localStorage; applied to Home and Search

### Components

```
components/
  ChannelCard       — logo, name, now-playing text, focus ring
  CategoryRow       — horizontal scroll row with keyboard focus trap
  VideoPlayer       — hls.js wrapper, stream switching, error/loading states
  QualitySelector   — reads hls.levels, manual level override, Auto default
  Overlay           — fade-in/out info bar over the player
  ChannelSidebar    — focusable channel list inside the player page
  FocusManager      — shared hook for D-pad / arrow-key navigation
  SettingsPanel     — language/country filter, persisted to localStorage
```

## Data Layer / API

### `GET /api/channels`
- Server-side fetch of the iptv-org M3U playlist (bypasses browser CORS)
- Parse into structured channel objects
- Group into category buckets (News, Sports, Entertainment, Music, Kids, Other)
- In-memory cache, **1 hour** TTL (keeps function invocations well within free
  tier)
- Returns JSON; the frontend never contacts iptv-org directly

### `GET /api/epg?channelId=xxx`
- Server-side fetch of the iptv-org EPG XML for matching channels
- Returns current + next programme
- In-memory cache, **30 minute** TTL
- Partial coverage; frontend handles missing EPG gracefully

### Core types

```ts
type Channel = {
  id: string
  name: string
  logo: string
  streamUrl: string
  category: string
  languages?: string[]
  countries?: string[]
  nowPlaying?: string   // from EPG, optional
}

type EpgEntry = {
  now?:  { title: string; start: string; end: string }
  next?: { title: string; start: string }
}
```

## Latency Expectations

Standard HLS (what iptv-org provides) carries an inherent **15–45 second** delay
versus a live broadcast — video is chunked into segments before delivery. This is
normal for browser IPTV and acceptable for this use case. Low-Latency HLS (2–4s)
is not relied upon because public sources rarely support it.

## State & Persistence

All client-side via `localStorage`:
- **Favorites** — pinned channels, shown in a top Home row
- **Recently watched** — last ~10 channels
- **Last channel** — for the "Continue watching" prompt
- **Filter preferences** — language/country from Settings

No server-side persistence; no database.

## Auth

None by default — a public URL is acceptable for family/friends. An **optional**
single shared password (via environment variable + a simple gate) is available if
the user later wants basic protection.

## LG OLED TV Deployment

- The TV already has the webOS **Homebrew Channel** installed; **no root
  required** for sideloading IPK apps.
- Package a thin **hosted-app IPK wrapper** (`appinfo.json` + minimal IPK) that
  launches the Vercel URL fullscreen. App code lives on Vercel; site updates
  appear on the TV with no reinstall.
- UI is built TV-first: D-pad focus navigation, large text, big targets, and
  clearly visible focus states — which also benefits desktop keyboard users.

## Error Handling

- **Dead streams:** `hls.js` fatal error → clear "Stream unavailable" state with
  a path to pick another channel
- **Buffering:** loading spinner while segments load
- **Missing EPG:** fall back to channel name only
- **Source fetch failure:** `/api/channels` / `/api/epg` return a clear error;
  frontend shows a retry affordance and, where possible, serves the last cached
  result

## Testing

- **Unit:** M3U parser, EPG parser, category grouping, localStorage
  favorites/recents helpers
- **Component:** ChannelCard focus states, CategoryRow keyboard navigation,
  QualitySelector visibility logic (multi- vs single-rendition)
- **Integration:** API routes return correctly shaped/grouped data; cache TTL
  behavior
- **Manual:** real HLS playback in-browser; D-pad navigation on the LG TV via
  the IPK wrapper

## Future Considerations (out of scope now)

- Additional M3U sources behind the existing `/api/channels` abstraction
- Migration to Cloudflare Pages if the app ever becomes commercial/public
  (Vercel free tier prohibits commercial use); the isolated cache/API layer
  keeps this a contained change
- Full EPG time-grid view
