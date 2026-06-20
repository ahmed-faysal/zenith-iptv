import { describe, it, expect } from "vitest";
import { bestLogo, type RawLogo } from "@/lib/enrich";

const logo = (o: Partial<RawLogo>): RawLogo => ({
  channel: "X.us", feed: null, in_use: true, tags: [],
  width: 100, height: 100, format: "PNG", url: "u", ...o,
});

describe("bestLogo", () => {
  it("returns undefined for no logos", () => {
    expect(bestLogo([])).toBeUndefined();
  });
  it("prefers in_use logos over not-in-use", () => {
    const r = bestLogo([logo({ in_use: false, url: "off" }), logo({ in_use: true, url: "on" })]);
    expect(r).toBe("on");
  });
  it("prefers SVG over PNG", () => {
    const r = bestLogo([logo({ format: "PNG", url: "png" }), logo({ format: "SVG", url: "svg" })]);
    expect(r).toBe("svg");
  });
  it("breaks format ties by larger area", () => {
    const r = bestLogo([
      logo({ format: "PNG", width: 100, height: 100, url: "small" }),
      logo({ format: "PNG", width: 400, height: 300, url: "big" }),
    ]);
    expect(r).toBe("big");
  });
  it("prefers a feed-specific logo when feed is given", () => {
    const r = bestLogo(
      [logo({ feed: null, url: "chan" }), logo({ feed: "HD", url: "feed" })],
      "HD",
    );
    expect(r).toBe("feed");
  });
});

import { applyEnrichment } from "@/lib/enrich";
import type { Channel } from "@/lib/types";

const chan = (o: Partial<Channel>): Channel => ({
  id: "CNN.us@HD", name: "CNN", logo: "m3u-logo", streamUrl: "u",
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("applyEnrichment", () => {
  it("overrides logo/category/country/quality when enrichment has them", () => {
    const out = applyEnrichment([chan({})], {
      "CNN.us@HD": { category: "News", country: "US", logo: "good.svg", quality: "1080p" },
    });
    expect(out[0]).toMatchObject({
      category: "News", countries: ["US"], logo: "good.svg", quality: "1080p",
    });
  });
  it("keeps M3U values when the id is absent from the map", () => {
    const out = applyEnrichment([chan({})], {});
    expect(out[0]).toMatchObject({ logo: "m3u-logo", category: "Other", quality: null });
  });
  it("keeps M3U logo when enrichment entry omits logo", () => {
    const out = applyEnrichment([chan({})], { "CNN.us@HD": { category: "News" } });
    expect(out[0].logo).toBe("m3u-logo");
  });
});

import { buildEnrichment, type RawChannel, type RawStream } from "@/lib/enrich";

describe("buildEnrichment", () => {
  const channels: RawChannel[] = [
    { id: "CNN.us", country: "US", categories: ["news"], languages: ["English"] },
  ];
  const logos: RawLogo[] = [
    { channel: "CNN.us", feed: null, in_use: true, tags: [], width: 300, height: 200, format: "SVG", url: "cnn.svg" },
  ];
  const streams: RawStream[] = [
    { channel: "CNN.us", feed: "HD", quality: "1080p" },
  ];

  it("joins metadata onto the M3U id (channel@feed)", () => {
    const map = buildEnrichment(["CNN.us@HD"], channels, logos, streams);
    expect(map["CNN.us@HD"]).toEqual({
      category: "News", country: "US", logo: "cnn.svg", quality: "1080p", languages: ["English"],
    });
  });
  it("matches quality by channel AND feed", () => {
    const map = buildEnrichment(["CNN.us@SD"], channels, logos, streams);
    expect(map["CNN.us@SD"].quality).toBeUndefined(); // no SD stream
    expect(map["CNN.us@SD"].country).toBe("US");      // metadata still joins
  });
  it("omits ids with no matching channel entirely", () => {
    const map = buildEnrichment(["Unknown.zz"], channels, logos, streams);
    expect(map["Unknown.zz"]).toBeUndefined();
  });
});
