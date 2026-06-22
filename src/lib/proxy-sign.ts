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
