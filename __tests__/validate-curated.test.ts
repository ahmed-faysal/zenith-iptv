import { describe, it, expect } from "vitest";
import { reorderWorkingFirst, buildCuratedFile } from "@/lib/validate/curated";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "CNN.us", name: "CNN", logo: "", category: "News",
  languages: ["English"], countries: ["US"],
  streamUrls: ["https://a/1.m3u8", "https://a/2.m3u8", "https://a/3.m3u8"],
};

describe("reorderWorkingFirst", () => {
  it("moves the working URL to the front, keeping the rest in order", () => {
    const out = reorderWorkingFirst(ch, "https://a/2.m3u8");
    expect(out.streamUrls).toEqual(["https://a/2.m3u8", "https://a/1.m3u8", "https://a/3.m3u8"]);
  });
  it("does not mutate the input channel", () => {
    reorderWorkingFirst(ch, "https://a/2.m3u8");
    expect(ch.streamUrls[0]).toBe("https://a/1.m3u8");
  });
  it("leaves other fields untouched", () => {
    const out = reorderWorkingFirst(ch, "https://a/3.m3u8");
    expect(out.id).toBe("CNN.us");
    expect(out.name).toBe("CNN");
    expect(out.category).toBe("News");
  });
});

describe("buildCuratedFile", () => {
  it("assembles generatedAt, summary, and channels", () => {
    const summary = { candidates: 100, fastProbePassed: 70, playable: 55 };
    const file = buildCuratedFile([ch], summary, new Date("2026-06-30T12:00:00Z"));
    expect(file.generatedAt).toBe("2026-06-30T12:00:00.000Z");
    expect(file.summary).toEqual(summary);
    expect(file.channels).toHaveLength(1);
  });
});
