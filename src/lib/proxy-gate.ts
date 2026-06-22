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
