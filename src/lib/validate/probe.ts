// Pure stream-reachability classification for the local validator.
export type ProbeVerdict = "ok" | "dead" | "blocked";

// Decide a single URL's reachability from its HTTP status and the first bytes of
// the body. For HLS manifests (.m3u8) we additionally require the playlist marker
// so a soft-404 HTML page served with status 200 doesn't count as alive.
export function classifyProbe(status: number, bodyStart: string, isManifest: boolean): ProbeVerdict {
  if (status === 401 || status === 403) return "blocked";
  if (status < 200 || status >= 400) return "dead";
  if (isManifest) return bodyStart.includes("#EXTM3U") ? "ok" : "dead";
  return "ok";
}

export function isManifestUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export type UrlProbe = (url: string) => Promise<{ status: number; bodyStart: string }>;

// Return the subset of a channel's URLs that probe "ok", preserving order.
// A channel survives the fast stage when this is non-empty. A probe that throws
// (DNS failure, connection refused) is treated as dead and skipped.
export async function probeChannelUrls(urls: string[], probe: UrlProbe): Promise<string[]> {
  const ok: string[] = [];
  for (const url of urls) {
    try {
      const { status, bodyStart } = await probe(url);
      if (classifyProbe(status, bodyStart, isManifestUrl(url)) === "ok") ok.push(url);
    } catch {
      // network throw == dead, skip
    }
  }
  return ok;
}
