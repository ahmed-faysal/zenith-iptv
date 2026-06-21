# Stream Proxy (Cloudflare Worker) — Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — pending implementation
**Branch:** `stream-proxy`

## Problem

~15% of catalogue stream URLs are `http://` (2,018 channels have *no* native
https URL), and only ~10% of those servers also speak TLS — so ≈14% of channels
are unplayable in-browser due to **mixed content**. Separately, some `https`
streams lack **CORS** headers (hls.js' XHR is blocked even though the stream is
alive — e.g. Fox Sports, alive but behind a now-dead public CORS proxy). These
failures skew toward popular/sports channels. A server-side proxy that re-serves
streams over https with CORS is the only fix that works from a browser.

## Goal

Recover the http / CORS-blocked channels by routing them through our own thin
HLS/CORS proxy (Cloudflare Worker — free at personal scale, no egress fees),
reusing the existing failover so a proxy failure degrades gracefully. Also unwrap
the handful of streams pre-wrapped in dead third-party proxies.

Non-goals: beating hard geo-blocks (origin sees Cloudflare's IP); proxying for
public/high-concurrency use (personal scale only); a bulletproof auth guard
(soft guard only — see below).

## Architecture

Two deployables, one feature:
1. **Cloudflare Worker** (`worker/`, deployed to the user's Cloudflare account) —
   the proxy.
2. **App changes** — decide which URLs to route through it, via a pure
   `expandPlaybackUrls` helper applied in `WatchView`. `VideoPlayer` and the
   failover are reused unchanged.

Data flow:
```
browser → direct attempt → origin                     (the ~85% that work)
browser → Worker → origin → Worker → browser          (http / CORS-blocked)
```

## 1. Cloudflare Worker — `worker/`

A `wrangler` project (its own `package.json`, `wrangler.toml`, `src/index.ts`),
deployed separately. Single fetch handler.

**Endpoint:** `GET /?url=<encoded absolute URL>&t=<token>`

**Request handling:**
1. **Guard** (see below). Reject with 403 if it fails.
2. Read + decode `url`. Reject non-http(s) targets (no `file:` etc.).
3. `fetch(target)` server-side (follow redirects; capture the final URL for base
   resolution).
4. **If the response is an HLS manifest** (content-type is an m3u8 type OR the
   body starts with `#EXTM3U`): rewrite it (below) and return as
   `application/vnd.apple.mpegurl`.
5. **Otherwise** (segments, keys, anything else): stream the body through,
   preserving the upstream `content-type`.
6. Always add CORS headers (`Access-Control-Allow-Origin`, allow GET/HEAD/OPTIONS,
   allow Range) and handle `OPTIONS` preflight.

**Manifest rewriting (the core):** parse the manifest line by line; for every
URI, resolve it to absolute against the manifest's final upstream URL, then
rewrite it to point back through the Worker (`<self>/?url=<enc absolute>&t=<token>`):
- bare URI lines (variant playlists in a master; `#EXTINF` segment lines in a
  media playlist),
- `URI="…"` attributes on `#EXT-X-KEY`, `#EXT-X-MAP`, `#EXT-X-MEDIA`.
Query strings / auth tokens in URIs are preserved (encode the whole absolute URL).
Comment/tag lines without URIs pass through untouched.

**Abuse guard (required):**
- **Origin allowlist:** check `request.headers.get("Origin")` (and `Referer` as a
  fallback) against an allowlist (`zenith-iptv.vercel.app`, `localhost`),
  configured via a Worker var `ALLOWED_ORIGINS`.
- **Shared token:** the request must carry `t=<token>` matching the Worker secret
  `STREAM_PROXY_TOKEN` (set via `wrangler secret put`).
- **Honest limitation:** the token ships in the client bundle (it's
  `NEXT_PUBLIC_…`), so it is a *soft* deterrent, not airtight; the Origin check
  adds a layer (browsers set `Origin`; non-browser clients can spoof it).
  Cloudflare's built-in rate-limiting is the backstop. This is acceptable for a
  personal app and documented as such.

**Config / deploy:** `wrangler.toml` defines the Worker name + `ALLOWED_ORIGINS`
var; `wrangler secret put STREAM_PROXY_TOKEN`; `wrangler deploy` → yields the
Worker URL (e.g. `https://zenith-proxy.<sub>.workers.dev`).

## 2. App routing — reuse the failover, no `VideoPlayer` change

Key change: **stop pre-upgrading URLs in storage.** `httpsUpgrade` is lossy
(`http://x` → `https://x` discards the original the proxy needs). Instead store
*original* URLs and decide scheme/proxy at playback time.

- **`src/lib/merge.ts`:** store original URLs (remove the `httpsUpgrade` calls);
  apply **`unwrapProxy`** to each URL before union/dedup (so wrapped + underlying
  collapse). Dedup on the (unwrapped) original string.
- **`src/lib/enrich.ts`:** remove the `httpsUpgrade` over enrichment alternates
  (originals stored; expansion handles scheme at play time).
- **New `src/lib/playback-urls.ts`** (cohesive URL module, pure + tested):
  - `httpsUpgrade(url)` — moved here from `merge.ts` (still re-exported where
    needed for existing importers/tests).
  - `unwrapProxy(url)` — registry of known third-party proxy shapes
    (`https://cors-proxy.cooks.fyi/<target>`, `…?url=<target>`, the one
    `*.workers.dev` wrapper) → returns the underlying URL, else the input.
  - `expandPlaybackUrls(urls, proxy?)` → ordered, deduped, capped attempt list:
    - no `proxy` configured → `https` direct as-is, `http` → `httpsUpgrade` only
      (current behavior; feature off).
    - `proxy` configured, per url: `https://…` → `[ url, proxyWrap(url) ]`;
      `http://…` → `[ httpsUpgrade(url), proxyWrap(url) ]` (the upgrade still
      grabs the ~10% TLS-capable servers free; the proxy fetches the original
      http for the rest).
    - `proxyWrap(url)` = `${proxy.base}?url=${encodeURIComponent(url)}&t=${proxy.token}`.
    - flatten, dedupe, cap at `MAX_SOURCES * 2`.
- **`src/components/WatchView.tsx`:** `srcs={expandPlaybackUrls(active.streamUrls, proxyConfig)}`
  where `proxyConfig` comes from `NEXT_PUBLIC_STREAM_PROXY_URL` +
  `NEXT_PUBLIC_STREAM_PROXY_TOKEN` (undefined → feature off).
- **`VideoPlayer.tsx`:** unchanged — it receives the (longer) attempt list and
  its existing failover walks direct → proxy → next source.

This is the brainstormed **A + B** in one mechanism: build-time unwrap + proxy
attempt entries (A) *and* direct-then-proxy per URL, which also catches
https-no-CORS (B).

## Error handling & limits

| Situation | Handling |
| --- | --- |
| Worker down / proxy attempt fails | failover advances to the next attempt/source; "Stream unavailable" only when all exhausted |
| Proxy not configured (env unset) | `expandPlaybackUrls` returns direct-only — feature cleanly off (like EPG) |
| Fully-dead channel | bounded: ≤ `MAX_SOURCES` sources × 2 attempts |
| Hard geo-block | not solved (origin sees Cloudflare IP) — documented |
| Worker abuse | Origin allowlist + token + Cloudflare rate-limit (soft, personal-scale) |

## Testing

- **Worker (`worker/` unit tests):** manifest rewrite — master variant URIs,
  media segment URIs, `#EXT-X-KEY`/`#EXT-X-MAP` `URI="…"`, relative-vs-absolute
  resolution, query-token preservation, non-manifest passthrough; guard rejects
  bad Origin / missing token.
- **`__tests__/playback-urls.test.ts`:** `httpsUpgrade`; `unwrapProxy` (each known
  shape + passthrough); `expandPlaybackUrls` (proxy off = direct-only; http →
  [upgrade, proxy]; https → [direct, proxy]; dedupe; cap; token in proxy URL).
- **`__tests__/merge.test.ts`:** update — stores originals (no upgrade), unwraps
  wrapped URLs before union; the old "https-upgrades before union" expectation
  moves to playback-urls.
- **`__tests__/enrich.test.ts`:** update — alternates stored as originals (drop
  the upgrade expectation; scheme now handled at play time).

## Files

- New: `worker/` (wrangler project: `package.json`, `wrangler.toml`,
  `src/index.ts`, tests), `src/lib/playback-urls.ts`,
  `__tests__/playback-urls.test.ts`.
- Modify: `src/lib/merge.ts` (store originals + `unwrapProxy`, drop upgrade),
  `src/lib/enrich.ts` (drop upgrade), `src/components/WatchView.tsx` (expand),
  `__tests__/merge.test.ts`, `__tests__/enrich.test.ts`.
- Unchanged: `src/components/VideoPlayer.tsx`, `src/lib/player.ts` (`nextSource`).
- Deploy/config: `wrangler deploy` (Cloudflare) → set `NEXT_PUBLIC_STREAM_PROXY_URL`
  + `NEXT_PUBLIC_STREAM_PROXY_TOKEN` in Vercel + `.env.local`.

## Deploy steps (post-implementation)

1. `cd worker && wrangler secret put STREAM_PROXY_TOKEN` (a random string), set
   `ALLOWED_ORIGINS`, `wrangler deploy` → copy the Worker URL.
2. Set `NEXT_PUBLIC_STREAM_PROXY_URL` (Worker URL) +
   `NEXT_PUBLIC_STREAM_PROXY_TOKEN` (same token) in Vercel prod and `.env.local`.
3. Redeploy the app; verify a known http/CORS channel (e.g. Fox Sports) now plays.
