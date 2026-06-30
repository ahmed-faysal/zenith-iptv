import { describe, it, expect } from "vitest";
import { classifyProbe, isManifestUrl, probeChannelUrls, type UrlProbe } from "@/lib/validate/probe";

describe("classifyProbe", () => {
  it("marks a valid HLS manifest ok", () => {
    expect(classifyProbe(200, "#EXTM3U\n#EXT-X-VERSION:3", true)).toBe("ok");
  });
  it("marks a 200 that is NOT a manifest dead (soft-404 HTML page)", () => {
    expect(classifyProbe(200, "<!DOCTYPE html>", true)).toBe("dead");
  });
  it("accepts a reachable non-manifest URL without the marker", () => {
    expect(classifyProbe(200, "", false)).toBe("ok");
  });
  it("treats 401/403 as blocked", () => {
    expect(classifyProbe(403, "", true)).toBe("blocked");
    expect(classifyProbe(401, "", true)).toBe("blocked");
  });
  it("treats 404/410/5xx/0 as dead", () => {
    expect(classifyProbe(404, "", true)).toBe("dead");
    expect(classifyProbe(410, "", true)).toBe("dead");
    expect(classifyProbe(503, "", true)).toBe("dead");
    expect(classifyProbe(0, "", true)).toBe("dead");
  });
});

describe("isManifestUrl", () => {
  it("detects .m3u8 with and without query", () => {
    expect(isManifestUrl("https://x/playlist.m3u8")).toBe(true);
    expect(isManifestUrl("https://x/playlist.m3u8?token=1")).toBe(true);
    expect(isManifestUrl("https://x/stream.ts")).toBe(false);
  });
});

describe("probeChannelUrls", () => {
  it("returns only ok urls in original order", async () => {
    const probe: UrlProbe = async (url) => {
      if (url.includes("good")) return { status: 200, bodyStart: "#EXTM3U" };
      if (url.includes("blocked")) return { status: 403, bodyStart: "" };
      return { status: 404, bodyStart: "" };
    };
    const out = await probeChannelUrls(
      ["https://a/good1.m3u8", "https://a/dead.m3u8", "https://a/blocked.m3u8", "https://a/good2.m3u8"],
      probe,
    );
    expect(out).toEqual(["https://a/good1.m3u8", "https://a/good2.m3u8"]);
  });
  it("treats a thrown probe (network error) as dead and skips it", async () => {
    const probe: UrlProbe = async (url) => {
      if (url.includes("throw")) throw new Error("ECONNREFUSED");
      return { status: 200, bodyStart: "#EXTM3U" };
    };
    const out = await probeChannelUrls(["https://a/throw.m3u8", "https://a/ok.m3u8"], probe);
    expect(out).toEqual(["https://a/ok.m3u8"]);
  });
});
