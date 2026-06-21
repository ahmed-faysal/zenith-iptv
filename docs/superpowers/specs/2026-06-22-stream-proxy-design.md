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
the handful of streams pre-wrapped in dead third-party proxies. Guard the proxy
with **HMAC-signed, catalogue-scoped tokens** so it can't be used as an open
relay.

Non-goals: beating hard geo-blocks (origin sees Cloudflare's IP); proxying for
public/high-concurrency use (personal scale only).

## Architecture

Two deployables + a signer route, one feature:
1. **Cloudflare Worker** (`worker/`, the user's Cloudflare account) — the proxy.
2. **Next `/api/proxy` route** — the *signer/gatekeeper* (runs on Vercel).
3. **App changes** — a pure `expandPlaybackUrls` helper applied in `WatchView`;
   `VideoPlayer` + failover reused unchanged.

Data flow:
```
browser → direct attempt → origin                                  (~85% that work)
browser → /api/proxy?url=T (Next: guard+sign, 302) → Worker?url=T&exp&sig
        → origin → Worker (rewrites manifest, self-signs child URIs) → browser
```
Only the **first** manifest fetch goes through Next; every variant/segment/key
after it is a Worker-signed URL fetched Worker-direct (Next isn't in the hot path).

## The secret

A single shared secret `STREAM_PROXY_SECRET` lives in **two server-only places**:
Vercel server env (for `/api/proxy`) and a Worker secret (`wrangler secret put`).
It is **never** `NEXT_PUBLIC` and never reaches the browser. HMAC = SHA-256 over
`"${url}\n${exp}"`, hex.

## 1. Next `/api/proxy` route (signer / gatekeeper)

`GET /api/proxy?url=<encoded target>` →
1. **Origin/Referer check** against the app's own origin (same-origin use only).
2. **Catalogue check:** the target must be a known stream URL from the current
   catalogue (`getChannels()` is already cached server-side; build a `Set` of its
   `streamUrls`). Rejects arbitrary URLs → not an open relay.
3. **Rate-limit** (simple in-memory token bucket per instance; Cloudflare/Vercel
   limits back it up).
4. Mint `exp = now + TTL` (TTL ~12h, generous so long live sessions don't break),
   `sig = HMAC(url, exp)`, and **302-redirect** to
   `${STREAM_PROXY_WORKER_URL}/?url=<enc>&exp=<exp>&sig=<sig>`.
5. If the proxy isn't configured (`STREAM_PROXY_WORKER_URL`/secret unset) → 503
   (the failover then skips this attempt).

`STREAM_PROXY_WORKER_URL` and `STREAM_PROXY_SECRET` are server-only env vars.

## 2. Cloudflare Worker — `worker/`

A `wrangler` project (`package.json`, `wrangler.toml`, `src/index.ts`), deployed
separately. Single fetch handler.

**Endpoint:** `GET /?url=<encoded>&exp=<ts>&sig=<hmac>`
1. **Verify:** recompute `HMAC(url, exp)` with the Worker's `STREAM_PROXY_SECRET`;
   reject (403) on mismatch or if `exp < now`.
2. `fetch(target)` server-side (follow redirects; capture final URL for base
   resolution).
3. **If an HLS manifest** (m3u8 content-type OR body starts with `#EXTM3U`):
   rewrite and return as `application/vnd.apple.mpegurl`.
4. **Else** (segments, keys): stream the body through, preserving upstream
   `content-type`.
5. Add CORS headers (`Access-Control-Allow-Origin` = app origin, allow
   GET/HEAD/OPTIONS + Range); handle `OPTIONS` preflight.

**Manifest rewriting (the core):** for every URI — bare URI lines (master variant
playlists; `#EXTINF` segments) and `URI="…"` attrs (`#EXT-X-KEY`, `#EXT-X-MAP`,
`#EXT-X-MEDIA`) — resolve to absolute against the manifest's final URL, then
emit `<self>/?url=<enc absolute>&exp=<fresh>&sig=<worker-signed>`. The Worker
**self-signs** these child URLs (it has the secret), so the browser can fetch
them directly without round-tripping Next. Query/auth tokens in URIs are preserved
(encode the whole absolute URL). Non-URI tag/comment lines pass through.

**Config:** `wrangler.toml` sets the Worker name + `APP_ORIGIN` var;
`wrangler secret put STREAM_PROXY_SECRET`; `wrangler deploy` → Worker URL.

## 3. App routing — reuse the failover, no `VideoPlayer` change

Key change: **stop pre-upgrading URLs in storage.** `httpsUpgrade` is lossy
(`http://x` → `https://x` discards the original the proxy must fetch). Store
*original* URLs; decide scheme/proxy at playback time.

- **`src/lib/merge.ts`:** store original URLs (remove `httpsUpgrade`); apply
  **`unwrapProxy`** to each URL before union/dedup (wrapped + underlying collapse).
- **`src/lib/enrich.ts`:** remove `httpsUpgrade` over enrichment alternates.
- **New `src/lib/playback-urls.ts`** (pure, tested):
  - `httpsUpgrade(url)` — moved here.
  - `unwrapProxy(url)` — registry of known third-party proxy shapes
    (`https://cors-proxy.cooks.fyi/<target>`, `…?url=<target>`, the `*.workers.dev`
    wrapper) → underlying URL, else input.
  - `expandPlaybackUrls(urls, proxyEnabled)` → ordered, deduped, capped attempts:
    - `proxyEnabled` false → `https` as-is, `http` → `httpsUpgrade` (feature off).
    - true, per url: `https://…` → `[ url, proxyPath(url) ]`; `http://…` →
      `[ httpsUpgrade(url), proxyPath(url) ]` (upgrade grabs the ~10% TLS servers
      free; the proxy fetches the original http for the rest).
    - `proxyPath(url)` = `/api/proxy?url=${encodeURIComponent(url)}` — a
      **same-origin** path (no secret, no Worker URL in the client).
    - flatten, dedupe, cap at `MAX_SOURCES * 2`.
- **`src/components/WatchView.tsx`:** `srcs={expandPlaybackUrls(active.streamUrls, proxyEnabled)}`
  where `proxyEnabled = process.env.NEXT_PUBLIC_STREAM_PROXY_ENABLED === "1"`
  (a non-secret on/off flag).
- **`VideoPlayer.tsx`:** unchanged — receives the longer attempt list; its failover
  walks direct → `/api/proxy` → next source.

This is the brainstormed **A + B** in one mechanism: build-time unwrap + proxy
attempts (A) *and* direct-then-proxy per URL, catching https-no-CORS (B).

## Shared HMAC — `src/lib/proxy-sign.ts`

`sign(url, exp, secret)` / `verify(url, exp, sig, secret)` using Web Crypto
(`crypto.subtle` HMAC-SHA-256) so the **same module works in both** the Next route
(Node/Edge) and the Worker. Pure, unit-tested. The Worker imports the same logic
(copied or shared) to keep sign/verify identical.

## Error handling & limits

| Situation | Handling |
| --- | --- |
| Worker/route down or proxy attempt fails | failover advances; "Stream unavailable" only when all exhausted |
| Proxy disabled (`NEXT_PUBLIC_STREAM_PROXY_ENABLED` ≠ 1) | `expandPlaybackUrls` returns direct-only — cleanly off (like EPG) |
| Fully-dead channel | bounded: ≤ `MAX_SOURCES` sources × 2 attempts |
| Forged/expired token | Worker 403; `/api/proxy` only signs catalogue URLs for our Origin |
| Hard geo-block | not solved (origin sees Cloudflare IP) — documented |

**Guard strength (honest):** the secret never reaches the client; signatures are
unforgeable and **bound to specific catalogue URLs**, so the proxy can't be used
as an open relay for arbitrary URLs. The residual surface is someone replaying a
captured signed URL until it expires, or hitting our rate-limited `/api/proxy`
for catalogue URLs — both low-impact at personal scale.

## Testing

- **`__tests__/proxy-sign.test.ts`:** `sign`/`verify` round-trip; tampered url/exp
  fails; expired fails.
- **Worker (`worker/` unit tests):** manifest rewrite (master variants, media
  segments, `#EXT-X-KEY`/`#EXT-X-MAP` URIs, relative-vs-absolute resolution, query
  preservation, child URLs are signed); non-manifest passthrough; verify rejects
  bad/expired sig.
- **`__tests__/api-proxy.test.ts`:** rejects foreign Origin; rejects URL not in
  catalogue; signs + 302s a valid catalogue URL; 503 when unconfigured.
- **`__tests__/playback-urls.test.ts`:** `httpsUpgrade`; `unwrapProxy` (each shape
  + passthrough); `expandPlaybackUrls` (off = direct-only; http → [upgrade,
  proxyPath]; https → [direct, proxyPath]; dedupe; cap).
- **`__tests__/merge.test.ts` / `enrich.test.ts`:** updated — store originals,
  `unwrapProxy` applied; the old https-upgrade expectations move to playback-urls.

## Files

- New: `worker/` (wrangler project + tests), `src/lib/playback-urls.ts`,
  `src/lib/proxy-sign.ts`, `src/app/api/proxy/route.ts`, and the matching tests.
- Modify: `src/lib/merge.ts` (originals + `unwrapProxy`, drop upgrade),
  `src/lib/enrich.ts` (drop upgrade), `src/components/WatchView.tsx` (expand),
  `__tests__/merge.test.ts`, `__tests__/enrich.test.ts`.
- Unchanged: `src/components/VideoPlayer.tsx`, `src/lib/player.ts`.

## Deploy steps (post-implementation)

1. Pick a random `STREAM_PROXY_SECRET`. `cd worker`, set `APP_ORIGIN`,
   `wrangler secret put STREAM_PROXY_SECRET`, `wrangler deploy` → copy Worker URL.
2. In Vercel (server env, NOT NEXT_PUBLIC): set `STREAM_PROXY_SECRET` (same value)
   and `STREAM_PROXY_WORKER_URL` (the Worker URL). Set
   `NEXT_PUBLIC_STREAM_PROXY_ENABLED=1`. Mirror into `.env.local` for dev.
3. Redeploy; verify a known http/CORS channel (e.g. Fox Sports) now plays.
