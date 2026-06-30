import { describe, it, expect } from "vitest";
import { SOURCES } from "@/lib/sources";

describe("source shortlist", () => {
  it("drops the full iptv-org index firehose", () => {
    expect(SOURCES.some((s) => s.url.endsWith("/iptv/index.m3u"))).toBe(false);
  });

  it("includes the curated shortlist labels", () => {
    const labels = SOURCES.map((s) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "abema", "atsushi-jp", "atsushi-tv", "iptv-jp",
        "iptv-news", "iptv-sports", "iptv-in", "iptv-bd", "free-tv",
      ]),
    );
  });

  it("tags News and Sports category sources so the 'Other' fallback is overridden", () => {
    expect(SOURCES.find((s) => s.label === "iptv-news")?.category).toBe("News");
    expect(SOURCES.find((s) => s.label === "iptv-sports")?.category).toBe("Sports");
  });
});
