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
    const expParam = u.searchParams.get("exp");
    const exp = expParam !== null ? Number(expParam) : NaN;
    const sig = u.searchParams.get("sig");
    if (!target || Number.isNaN(exp) || !sig) return new Response("bad request", { status: 400 });
    const now = Date.now();
    if (exp < now) return new Response("expired", { status: 403 });
    if (!(await verify(target, exp, sig, env.STREAM_PROXY_SECRET))) return new Response("forbidden", { status: 403 });

    const range = request.headers.get("Range");
    const upstream = await fetch(target, { headers: range ? { Range: range } : {}, redirect: "follow" });
    const ct = upstream.headers.get("content-type") ?? "";

    if (isManifest(upstream.url || target, ct)) {
      const body = await rewriteManifest(await upstream.text(), upstream.url || target, self, env.STREAM_PROXY_SECRET, now, 12 * 60 * 60 * 1000);
      const h = cors(new Headers());
      h.set("content-type", "application/vnd.apple.mpegurl");
      return new Response(body, { status: 200, headers: h });
    }

    const h = cors(new Headers());
    for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
      const v = upstream.headers.get(k);
      if (v) h.set(k, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers: h });
  },
};
