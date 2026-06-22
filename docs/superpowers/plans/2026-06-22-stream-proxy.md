# Stream Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover http / CORS-blocked channels via our own Cloudflare Worker HLS/CORS proxy, gated by HMAC-signed catalogue-scoped tokens, reusing the existing failover.

**Architecture:** Store original (un-upgraded) URLs; a pure `expandPlaybackUrls` helper (applied in WatchView) turns each into `[direct, /api/proxy?url=…]` attempts. The Next `/api/proxy` route checks Origin + validates the URL is in our catalogue, HMAC-signs `(url, exp)` and 302s to the Worker. The Worker verifies the signature, fetches the origin, rewrites HLS manifests (self-signing child URIs), and streams everything back with CORS. VideoPlayer/failover unchanged.

**Tech Stack:** Next.js 16 + React 19, TypeScript, Vitest; Cloudflare Workers (wrangler); Web Crypto (HMAC-SHA-256).

## Global Constraints

- The signing secret `STREAM_PROXY_SECRET` is **server-only** (Vercel server env + Worker secret) — never `NEXT_PUBLIC`, never in the client bundle.
- HMAC = SHA-256 over the exact string `` `${url}\n${exp}` ``, lowercase hex. Sign/verify must be byte-identical in the Next route and the Worker.
- Client uses only the **same-origin** path `/api/proxy?url=<encoded target>`; the proxy on/off is the non-secret flag `NEXT_PUBLIC_STREAM_PROXY_ENABLED === "1"`.
- Store **original** URLs in the catalogue (no `httpsUpgrade` in `merge`/`enrich`); scheme/proxy decisions happen only in `expandPlaybackUrls`.
- `MAX_SOURCES = 4` (in `enrich.ts`); `expandPlaybackUrls` caps at `MAX_SOURCES * 2`.
- TTL for signed URLs ~12h. Worker rejects expired or bad signatures (403).
- Feature degrades off cleanly: env unset → `/api/proxy` 503s and `expandPlaybackUrls` emits direct-only.

---

### Task 1: Shared HMAC — `src/lib/proxy-sign.ts`

Pure Web-Crypto sign/verify, reused by the Next route and (copied identically) by the Worker.

**Files:**
- Create: `src/lib/proxy-sign.ts`
- Test: `__tests__/proxy-sign.test.ts`

**Interfaces:**
- Produces: `sign(url: string, exp: number, secret: string): Promise<string>`, `verify(url: string, exp: number, sig: string, secret: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/proxy-sign.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sign, verify } from "@/lib/proxy-sign";

const SECRET = "test-secret";

describe("proxy-sign", () => {
  it("verifies a signature it produced", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/a.m3u8", exp, sig, SECRET)).toBe(true);
  });
  it("rejects a tampered url", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/b.m3u8", exp, sig, SECRET)).toBe(false);
  });
  it("rejects a tampered exp", async () => {
    const sig = await sign("https://x/a.m3u8", 1_000_000, SECRET);
    expect(await verify("https://x/a.m3u8", 2_000_000, sig, SECRET)).toBe(false);
  });
  it("rejects a wrong secret", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/a.m3u8", exp, sig, "other")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/proxy-sign.test.ts`
Expected: FAIL — `@/lib/proxy-sign` does not exist.

- [ ] **Step 3: Implement `src/lib/proxy-sign.ts`**

```ts
// HMAC-SHA-256 over `${url}\n${exp}` as lowercase hex. Uses Web Crypto so the
// exact same logic runs in Node, the Next runtime, and a Cloudflare Worker.
async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sign(url: string, exp: number, secret: string): Promise<string> {
  return hmacHex(secret, `${url}\n${exp}`);
}

export async function verify(url: string, exp: number, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacHex(secret, `${url}\n${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/proxy-sign.test.ts && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proxy-sign.ts __tests__/proxy-sign.test.ts
git commit -m "feat: HMAC sign/verify for the stream proxy"
```

---

### Task 2: Playback URL expansion — `src/lib/playback-urls.ts`

The pure URL logic: https-upgrade, unwrap third-party proxies, and expand each source into ordered direct→proxy attempts.

**Files:**
- Create: `src/lib/playback-urls.ts`
- Test: `__tests__/playback-urls.test.ts`

**Interfaces:**
- Consumes: `MAX_SOURCES` from `@/lib/enrich`.
- Produces: `httpsUpgrade(url: string): string`, `unwrapProxy(url: string): string`, `expandPlaybackUrls(urls: string[], proxyEnabled: boolean): string[]`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/playback-urls.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { httpsUpgrade, unwrapProxy, expandPlaybackUrls } from "@/lib/playback-urls";

describe("httpsUpgrade", () => {
  it("upgrades http to https", () => {
    expect(httpsUpgrade("http://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
  it("leaves https untouched", () => {
    expect(httpsUpgrade("https://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
});

describe("unwrapProxy", () => {
  it("unwraps a nested-scheme proxy (cooks.fyi)", () => {
    expect(unwrapProxy("https://cors-proxy.cooks.fyi/http://190.11.225.124:5000/a.m3u8"))
      .toBe("http://190.11.225.124:5000/a.m3u8");
  });
  it("unwraps a ?url= style proxy", () => {
    expect(unwrapProxy("https://p.example.com/?url=" + encodeURIComponent("https://real/a.m3u8")))
      .toBe("https://real/a.m3u8");
  });
  it("leaves a normal url untouched", () => {
    expect(unwrapProxy("https://real/a.m3u8")).toBe("https://real/a.m3u8");
  });
});

describe("expandPlaybackUrls", () => {
  it("proxy off: https direct, http upgraded, no proxy entries", () => {
    expect(expandPlaybackUrls(["https://a/x.m3u8", "http://b/y.m3u8"], false))
      .toEqual(["https://a/x.m3u8", "https://b/y.m3u8"]);
  });
  it("proxy on, https: [direct, proxyPath]", () => {
    expect(expandPlaybackUrls(["https://a/x.m3u8"], true))
      .toEqual(["https://a/x.m3u8", "/api/proxy?url=" + encodeURIComponent("https://a/x.m3u8")]);
  });
  it("proxy on, http: [https-upgrade, proxyPath of original http]", () => {
    expect(expandPlaybackUrls(["http://b/y.m3u8"], true))
      .toEqual(["https://b/y.m3u8", "/api/proxy?url=" + encodeURIComponent("http://b/y.m3u8")]);
  });
  it("dedupes and caps at MAX_SOURCES*2 (8)", () => {
    const urls = ["https://1","https://2","https://3","https://4","https://5"];
    const out = expandPlaybackUrls(urls, true);
    expect(out.length).toBe(8);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/playback-urls.test.ts`
Expected: FAIL — `@/lib/playback-urls` does not exist.

- [ ] **Step 3: Implement `src/lib/playback-urls.ts`**

```ts
import { MAX_SOURCES } from "./enrich";

// http:// is blocked on our https origin; upgrade so TLS-capable servers play.
export function httpsUpgrade(url: string): string {
  return url.startsWith("http://") ? "https://" + url.slice("http://".length) : url;
}

// Known third-party CORS/proxy wrappers -> the underlying URL (else input).
export function unwrapProxy(url: string): string {
  const nested = url.match(/^https?:\/\/[^/]+\/(https?:\/\/.+)$/);
  if (nested && /cors-proxy\.cooks\.fyi|workers\.dev/.test(url)) return nested[1];
  try {
    const inner = new URL(url).searchParams.get("url");
    if (inner && /^https?:\/\//.test(inner)) return inner;
  } catch { /* not a parseable URL */ }
  return url;
}

// Ordered playback attempts. Direct first (https as-is, http upgraded for the
// ~10% TLS-capable servers); then a same-origin /api/proxy attempt over the
// ORIGINAL url (so the proxy fetches the real http/https origin). Deduped, capped.
export function expandPlaybackUrls(urls: string[], proxyEnabled: boolean): string[] {
  const out: string[] = [];
  for (const u of urls) {
    out.push(httpsUpgrade(u));
    if (proxyEnabled) out.push(`/api/proxy?url=${encodeURIComponent(u)}`);
  }
  return [...new Set(out)].slice(0, MAX_SOURCES * 2);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/playback-urls.test.ts && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/playback-urls.ts __tests__/playback-urls.test.ts
git commit -m "feat: playback URL expansion (upgrade, unwrap, direct+proxy attempts)"
```

---

### Task 3: Store original URLs — refactor `merge.ts` + `enrich.ts`

Stop pre-upgrading URLs; store originals and unwrap third-party proxies at merge.

**Files:**
- Modify: `src/lib/merge.ts`
- Modify: `src/lib/enrich.ts`
- Modify: `__tests__/merge.test.ts`
- Modify: `__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `unwrapProxy` from `@/lib/playback-urls` (Task 2); `MAX_SOURCES` from `@/lib/enrich`.
- Produces: `mergeSources` stores original (unwrapped) URLs; `applyEnrichment` appends original alternate URLs (no upgrade). `httpsUpgrade` is no longer exported from `merge.ts`/`enrich.ts` (it now lives in `playback-urls.ts`).

- [ ] **Step 1: Update the tests first**

In `__tests__/merge.test.ts`:
- Delete the entire `describe("httpsUpgrade", …)` block (it moved to playback-urls).
- Change the import line to drop `httpsUpgrade`:

```ts
import { normalizeName, identityKey, mergeSources } from "@/lib/merge";
```

- Replace the test `"https-upgrades urls before union (http+https for same path collapse)"` with an unwrap test:

```ts
  it("unwraps a third-party proxy before union (wrapped + underlying collapse)", () => {
    const a = [ch({ id: "CNN.us", streamUrls: ["https://cors-proxy.cooks.fyi/http://x/a"] })];
    const b = [ch({ id: "CNN.us", streamUrls: ["http://x/a"] })];
    const out = mergeSources([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["http://x/a"]);
  });
```

- The existing "unions stream URLs … deduped + capped" test currently uses `https://…` inputs and expects them unchanged; that still holds (no upgrade changes them). Leave it.

In `__tests__/enrich.test.ts`, replace the test `"upgrades http alternate URLs to https when merging enrichment"` with:

```ts
  it("appends alternate URLs as-is (originals, no upgrade)", () => {
    const out = applyEnrichment(
      [chan({ streamUrls: ["https://primary"] })],
      { "CNN.us@HD": { urls: ["http://alt-1", "https://alt-2"] } },
    );
    expect(out[0].streamUrls).toEqual(["https://primary", "http://alt-1", "https://alt-2"]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run __tests__/merge.test.ts __tests__/enrich.test.ts`
Expected: FAIL — merge still upgrades / still exports `httpsUpgrade`; enrich still upgrades alternates.

- [ ] **Step 3: Refactor `src/lib/merge.ts`**

Replace the top imports and the URL handling. New full file:

```ts
import type { Channel } from "./types";
import { MAX_SOURCES } from "./enrich";
import { unwrapProxy } from "./playback-urls";

// Normalize a name for fuzzy cross-source identity: lowercase, drop
// resolution/quality tokens and non-alphanumerics ("ESPN HD" -> "espn").
const QUALITY = /\b(?:\d{3,4}p|[0-9]+k|hd|sd|fhd|uhd|hq|lq)\b/g;
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(QUALITY, " ").replace(/[^\p{L}\p{N}]+/gu, "");
}

// Merge identity: a real tvg-id (contains ".", e.g. "CNN.us") is the strong
// signal; else normalized name + primary country.
export function identityKey(c: Channel): string {
  if (c.id.includes(".")) return `id:${c.id}`;
  const norm = normalizeName(c.name);
  return `name:${norm || c.id}|${c.countries[0] ?? ""}`;
}

function capUrls(urls: string[]): string[] {
  return [...new Set(urls.map(unwrapProxy))].slice(0, MAX_SOURCES);
}

// Merge channels from several sources (priority order) into one catalogue. Same
// identity -> one channel; streamUrls = union of ORIGINAL urls (third-party
// proxies unwrapped, deduped, capped). First source wins metadata; later ones
// fill only blank fields. Scheme/proxy decisions happen later in playback-urls.
export function mergeSources(lists: Channel[][]): Channel[] {
  const byKey = new Map<string, Channel>();
  const order: string[] = [];
  for (const list of lists) {
    for (const c of list) {
      const key = identityKey(c);
      const existing = byKey.get(key);
      if (!existing) {
        order.push(key);
        byKey.set(key, {
          ...c,
          streamUrls: capUrls(c.streamUrls),
          languages: [...c.languages],
          countries: [...c.countries],
        });
        continue;
      }
      existing.streamUrls = capUrls([...existing.streamUrls, ...c.streamUrls]);
      if (!existing.logo && c.logo) existing.logo = c.logo;
      if (existing.languages.length === 0 && c.languages.length) existing.languages = [...c.languages];
      if (existing.countries.length === 0 && c.countries.length) existing.countries = [...c.countries];
      if (existing.category === "Other" && c.category !== "Other") existing.category = c.category;
    }
  }
  return order.map((k) => byKey.get(k)!);
}
```

- [ ] **Step 4: Refactor `src/lib/enrich.ts`**

Delete the `httpsUpgrade` function (the `export function httpsUpgrade…` block near the top, including its 2-line comment). Then change the `streamUrls` line in `applyEnrichment` to not upgrade:

```ts
    const streamUrls = e.urls?.length
      ? dedupe([...c.streamUrls, ...e.urls]).slice(0, MAX_SOURCES)
      : c.streamUrls;
```

Leave `MAX_SOURCES`, `dedupe`, and everything else unchanged.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors. (No file should still import `httpsUpgrade` from `@/lib/enrich` or `@/lib/merge`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/merge.ts src/lib/enrich.ts __tests__/merge.test.ts __tests__/enrich.test.ts
git commit -m "refactor: store original stream URLs; unwrap third-party proxies at merge"
```

---

### Task 4: Wire expansion into `WatchView`

Pass proxy-expanded attempts to the player.

**Files:**
- Modify: `src/components/WatchView.tsx`

**Interfaces:**
- Consumes: `expandPlaybackUrls` (Task 2).

- [ ] **Step 1: Update WatchView**

In `src/components/WatchView.tsx`, add the import:

```tsx
import { expandPlaybackUrls } from "@/lib/playback-urls";
```

Add this near the other derived values (after `active` is defined):

```tsx
  const proxyEnabled = process.env.NEXT_PUBLIC_STREAM_PROXY_ENABLED === "1";
```

Change the `<VideoPlayer>` `srcs` prop from `srcs={active.streamUrls}` to:

```tsx
        srcs={expandPlaybackUrls(active.streamUrls, proxyEnabled)}
```

- [ ] **Step 2: Typecheck, full suite, lint, build**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: no type errors; all tests pass; lint clean except the pre-existing `<img>` warning; build "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add src/components/WatchView.tsx
git commit -m "feat: route playback through proxy-expanded URLs in WatchView"
```

---

### Task 5: `/api/proxy` signer route + gate

The Origin/catalogue/sign gate (pure, tested) and the thin Next route.

**Files:**
- Create: `src/lib/proxy-gate.ts`
- Create: `src/app/api/proxy/route.ts`
- Test: `__tests__/proxy-gate.test.ts`

**Interfaces:**
- Consumes: `sign` (Task 1), `getChannels` from `@/lib/source`.
- Produces: `decideProxy(input): Promise<{ status: number; location?: string; body?: string }>`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/proxy-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideProxy } from "@/lib/proxy-gate";

const base = {
  self: "https://app.example",
  channelUrls: new Set(["https://real/a.m3u8"]),
  secret: "s",
  workerUrl: "https://worker.example",
  now: 1_000_000,
  ttlMs: 1000,
  limited: false,
};

describe("decideProxy", () => {
  it("503 when not configured", async () => {
    const r = await decideProxy({ ...base, secret: undefined, target: "https://real/a.m3u8", origin: "" });
    expect(r.status).toBe(503);
  });
  it("403 for a foreign origin", async () => {
    const r = await decideProxy({ ...base, target: "https://real/a.m3u8", origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
  it("403 for a url not in the catalogue", async () => {
    const r = await decideProxy({ ...base, target: "https://other/x.m3u8", origin: "https://app.example" });
    expect(r.status).toBe(403);
  });
  it("429 when rate-limited", async () => {
    const r = await decideProxy({ ...base, target: "https://real/a.m3u8", origin: "https://app.example", limited: true });
    expect(r.status).toBe(429);
  });
  it("302s to the worker with a signature for a valid catalogue url", async () => {
    const r = await decideProxy({ ...base, target: "https://real/a.m3u8", origin: "https://app.example" });
    expect(r.status).toBe(302);
    expect(r.location).toMatch(/^https:\/\/worker\.example\/\?url=/);
    expect(r.location).toMatch(/exp=1001000/);
    expect(r.location).toMatch(/sig=[0-9a-f]{64}/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/proxy-gate.test.ts`
Expected: FAIL — `@/lib/proxy-gate` does not exist.

- [ ] **Step 3: Implement `src/lib/proxy-gate.ts`**

```ts
import { sign } from "./proxy-sign";

export type GateInput = {
  target: string | null;
  origin: string;          // request Origin/Referer ("" if none)
  self: string;            // the app's own origin
  channelUrls: Set<string>;
  secret?: string;
  workerUrl?: string;
  limited?: boolean;
  now?: number;
  ttlMs?: number;
};
export type GateResult = { status: number; location?: string; body?: string };

const DEFAULT_TTL = 12 * 60 * 60 * 1000;

// Pure gate: 503 unconfigured, 403 foreign origin / unknown url, 429 limited,
// else 302 to the worker with an HMAC-signed (url, exp).
export async function decideProxy(i: GateInput): Promise<GateResult> {
  if (!i.secret || !i.workerUrl) return { status: 503, body: "proxy disabled" };
  if (i.origin && !i.origin.startsWith(i.self)) return { status: 403, body: "forbidden" };
  if (!i.target) return { status: 400, body: "missing url" };
  if (!i.channelUrls.has(i.target)) return { status: 403, body: "unknown url" };
  if (i.limited) return { status: 429, body: "rate limited" };
  const exp = (i.now ?? Date.now()) + (i.ttlMs ?? DEFAULT_TTL);
  const sig = await sign(i.target, exp, i.secret);
  const location = `${i.workerUrl}/?url=${encodeURIComponent(i.target)}&exp=${exp}&sig=${sig}`;
  return { status: 302, location };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/proxy-gate.test.ts`
Expected: all PASS.

- [ ] **Step 5: Implement the route `src/app/api/proxy/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getChannels } from "@/lib/source";
import { decideProxy } from "@/lib/proxy-gate";
import type { Channel } from "@/lib/types";

// Memoized Set of catalogue stream URLs, rebuilt only when the channel list ref
// changes (getChannels is cached server-side for an hour).
let cache: { ref: Channel[]; set: Set<string> } | null = null;
function channelUrlSet(channels: Channel[]): Set<string> {
  if (cache?.ref === channels) return cache.set;
  const set = new Set<string>();
  for (const c of channels) for (const u of c.streamUrls) set.add(u);
  cache = { ref: channels, set };
  return set;
}

// Best-effort per-instance fixed-window rate limit (Cloudflare/Vercel back it up).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  e.count++;
  return e.count > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  const channels = await getChannels().catch(() => [] as Channel[]);
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const res = await decideProxy({
    target: req.nextUrl.searchParams.get("url"),
    origin: req.headers.get("origin") ?? req.headers.get("referer") ?? "",
    self: req.nextUrl.origin,
    channelUrls: channelUrlSet(channels),
    secret: process.env.STREAM_PROXY_SECRET,
    workerUrl: process.env.STREAM_PROXY_WORKER_URL,
    limited: rateLimited(ip),
  });
  if (res.status === 302 && res.location) return NextResponse.redirect(res.location, 302);
  return new NextResponse(res.body ?? "", { status: res.status });
}
```

- [ ] **Step 6: Typecheck, full suite, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all tests pass; build "Compiled successfully" with `/api/proxy` listed in the route table.

- [ ] **Step 7: Commit**

```bash
git add src/lib/proxy-gate.ts src/app/api/proxy/route.ts __tests__/proxy-gate.test.ts
git commit -m "feat: /api/proxy signer route (origin + catalogue gate, HMAC sign)"
```

---

### Task 6: Cloudflare Worker — `worker/`

The proxy that verifies the signature, fetches the origin, rewrites HLS manifests (self-signing children), and streams back with CORS.

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/tsconfig.json`
- Create: `worker/src/index.ts`
- Create: `worker/src/index.test.ts`

**Interfaces:**
- Self-contained. Mirrors `sign`/`verify` from Task 1 (identical HMAC) so the Next-issued signature verifies here.

- [ ] **Step 1: Scaffold the worker project files**

Create `worker/package.json`:

```json
{
  "name": "zenith-stream-proxy",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "vitest": "^4.1.9",
    "wrangler": "^3"
  }
}
```

Create `worker/wrangler.toml`:

```toml
name = "zenith-stream-proxy"
main = "src/index.ts"
compatibility_date = "2026-06-01"

# secret: set via `wrangler secret put STREAM_PROXY_SECRET`
# (CORS is `*` — the HMAC signature is the guard, not the Worker's CORS origin.)
```

Create `worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "WebWorker"],
    "types": [],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test**

Create `worker/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sign, verify, isManifest, rewriteManifest } from "./index";

const SECRET = "s";

describe("worker hmac parity", () => {
  it("verifies what it signs", async () => {
    const sig = await sign("https://x/a.m3u8", 5, SECRET);
    expect(await verify("https://x/a.m3u8", 5, sig, SECRET)).toBe(true);
    expect(await verify("https://x/a.m3u8", 6, sig, SECRET)).toBe(false);
  });
});

describe("isManifest", () => {
  it("detects by content-type and by .m3u8 path", () => {
    expect(isManifest("https://x/a.ts", "application/vnd.apple.mpegurl")).toBe(true);
    expect(isManifest("https://x/a.m3u8", "application/octet-stream")).toBe(true);
    expect(isManifest("https://x/seg.ts", "video/mp2t")).toBe(false);
  });
});

describe("rewriteManifest", () => {
  it("rewrites bare segment URIs and URI=\"…\" attrs through self, signed", async () => {
    const m = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
      "#EXTINF:6,",
      "seg1.ts",
      "https://abs.example/seg2.ts",
    ].join("\n");
    const out = await rewriteManifest(m, "https://base.example/live/index.m3u8", "https://w.example", SECRET, 1000, 10);
    // relative key + segment resolved against base, absolute kept; all wrapped via self
    expect(out).toContain('URI="https://w.example/?url=' + encodeURIComponent("https://base.example/live/key.bin"));
    expect(out).toContain("https://w.example/?url=" + encodeURIComponent("https://base.example/live/seg1.ts"));
    expect(out).toContain("https://w.example/?url=" + encodeURIComponent("https://abs.example/seg2.ts"));
    expect(out).toContain("#EXTINF:6,");           // tag lines preserved
    expect(out).toMatch(/sig=[0-9a-f]{64}/);       // children are signed
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd worker && npm install && npx vitest run`
Expected: FAIL — `./index` exports don't exist yet.

- [ ] **Step 4: Implement `worker/src/index.ts`**

```ts
// Zenith stream proxy: verifies an HMAC-signed (url, exp), fetches the origin,
// rewrites HLS manifests (self-signing child URIs) and streams everything back
// with CORS. HMAC must be byte-identical to src/lib/proxy-sign.ts.

interface Env { STREAM_PROXY_SECRET: string }

async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sign(url: string, exp: number, secret: string): Promise<string> {
  return hmacHex(secret, `${url}\n${exp}`);
}
export async function verify(url: string, exp: number, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacHex(secret, `${url}\n${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function isManifest(targetUrl: string, contentType: string): boolean {
  if (/mpegurl/i.test(contentType)) return true;
  try { return new URL(targetUrl).pathname.toLowerCase().endsWith(".m3u8"); }
  catch { return false; }
}

async function wrap(absUrl: string, self: string, secret: string, exp: number): Promise<string> {
  const sig = await sign(absUrl, exp, secret);
  return `${self}/?url=${encodeURIComponent(absUrl)}&exp=${exp}&sig=${sig}`;
}

export async function rewriteManifest(
  text: string, baseUrl: string, self: string, secret: string, now: number, ttlMs: number,
): Promise<string> {
  const exp = now + ttlMs;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      const m = line.match(/URI="([^"]+)"/);
      if (m) {
        const abs = new URL(m[1], baseUrl).toString();
        out.push(line.replace(/URI="[^"]+"/, `URI="${await wrap(abs, self, secret, exp)}"`));
      } else out.push(line);
    } else if (line.trim() === "") {
      out.push(line);
    } else {
      const abs = new URL(line.trim(), baseUrl).toString();
      out.push(await wrap(abs, self, secret, exp));
    }
  }
  return out.join("\n");
}

// CORS is `*`: the HMAC signature is the access guard, not the Worker's origin
// (origin restriction happens upstream at /api/proxy). `*` avoids dev/prod origin
// mismatches; requests are non-credentialed media GETs.
function cors(h: Headers): Headers {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Range");
  return h;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const self = new URL(request.url).origin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(new Headers()) });

    const u = new URL(request.url);
    const target = u.searchParams.get("url");
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig") ?? "";
    if (!target || !exp || !sig) return new Response("bad request", { status: 400 });
    if (exp < Date.now()) return new Response("expired", { status: 403 });
    if (!(await verify(target, exp, sig, env.STREAM_PROXY_SECRET))) return new Response("forbidden", { status: 403 });

    const range = request.headers.get("Range");
    const upstream = await fetch(target, { headers: range ? { Range: range } : {}, redirect: "follow" });
    const ct = upstream.headers.get("content-type") ?? "";

    if (isManifest(upstream.url || target, ct)) {
      const body = await rewriteManifest(await upstream.text(), upstream.url || target, self, env.STREAM_PROXY_SECRET, Date.now(), 12 * 60 * 60 * 1000);
      const h = cors(new Headers());
      h.set("content-type", "application/vnd.apple.mpegurl");
      return new Response(body, { status: 200, headers: h });
    }

    const h = cors(new Headers(upstream.headers));
    return new Response(upstream.body, { status: upstream.status, headers: h });
  },
};
```

- [ ] **Step 5: Run the worker tests + typecheck**

Run: `cd worker && npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Verify HMAC parity with the app**

Run from the repo root: `npx tsx -e "import('./src/lib/proxy-sign.ts').then(async m=>{const s=await m.sign('https://x/a.m3u8',5,'s'); console.log('app sig', s);})"` and compare to a worker-side sign of the same inputs (add a temporary log in a scratch test). Expected: identical hex string — confirms a Next-issued signature verifies in the Worker. (Remove any scratch log after.)

- [ ] **Step 7: Commit**

```bash
git add worker/
git commit -m "feat: Cloudflare Worker HLS/CORS proxy (verify, manifest rewrite, stream)"
```

---

## Deploy (post-merge, needs your Cloudflare account)

1. Choose a random `STREAM_PROXY_SECRET`. In `worker/`: edit `APP_ORIGIN` if needed, `npx wrangler secret put STREAM_PROXY_SECRET`, `npx wrangler deploy` → copy the Worker URL.
2. In Vercel **server** env (not NEXT_PUBLIC): `STREAM_PROXY_SECRET` (same value), `STREAM_PROXY_WORKER_URL` (the Worker URL). Set `NEXT_PUBLIC_STREAM_PROXY_ENABLED=1`. Mirror into `.env.local`.
3. Redeploy the app; open a known http/CORS channel (e.g. Fox Sports) and confirm it plays via the proxy.

---

## Self-Review

**Spec coverage:**
- HMAC sign/verify, secret server-only → Task 1; mirrored in Worker → Task 6.
- Store originals, unwrap third-party proxies → Task 3 (+ `unwrapProxy` in Task 2).
- `expandPlaybackUrls` (direct + same-origin `/api/proxy`, http upgrade, cap) → Task 2; wired → Task 4.
- `/api/proxy` gate (Origin + catalogue + rate-limit + sign + 302), 503 unconfigured → Task 5.
- Worker verify + manifest rewrite (bare + `URI="…"`, relative resolution, child signing) + non-manifest passthrough + CORS → Task 6.
- Degrades off (flag/env unset) → Tasks 2, 4, 5.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `sign`/`verify` signatures match across Task 1, 5, 6. `expandPlaybackUrls(urls, proxyEnabled)` (Task 2) consumed in Task 4. `decideProxy` input/return (Task 5) matches its test. `unwrapProxy` (Task 2) consumed in Task 3. `MAX_SOURCES` stays in `enrich.ts`; `httpsUpgrade` exists only in `playback-urls.ts` after Task 3 (no remaining importers of it from `merge`/`enrich`).
