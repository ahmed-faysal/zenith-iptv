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
