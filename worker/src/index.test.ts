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
