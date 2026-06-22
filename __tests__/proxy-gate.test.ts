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
  it("400 when target is missing", async () => {
    const r = await decideProxy({ ...base, target: null, origin: "https://app.example" });
    expect(r.status).toBe(400);
  });
  it("503 when only workerUrl is unset", async () => {
    const r = await decideProxy({ ...base, workerUrl: undefined, target: "https://real/a.m3u8", origin: "https://app.example" });
    expect(r.status).toBe(503);
  });
  it("403 for a sibling-prefix origin (origin bypass regression)", async () => {
    const r = await decideProxy({ ...base, target: "https://real/a.m3u8", origin: "https://app.example.evil.com", self: "https://app.example" });
    expect(r.status).toBe(403);
  });
});
