import { describe, it, expect } from "vitest";
import { normalizeName, identityKey, mergeSources } from "@/lib/merge";
import type { Channel } from "@/lib/types";

const ch = (o: Partial<Channel>): Channel => ({
  id: "X", name: "X", logo: "", streamUrls: ["https://x"],
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("normalizeName", () => {
  it("strips quality/resolution tokens and non-alphanumerics", () => {
    expect(normalizeName("ESPN HD")).toBe("espn");
    expect(normalizeName("ESPN (1080p)")).toBe("espn");
  });
});

describe("identityKey", () => {
  it("keys on a real tvg-id (contains a dot)", () => {
    expect(identityKey(ch({ id: "CNN.us" }))).toBe("id:CNN.us");
  });
  it("keys on normalized name + country when id is a slug", () => {
    expect(identityKey(ch({ id: "some-channel", name: "Some Channel", countries: ["US"] })))
      .toBe("name:somechannel|US");
  });

  it("falls back to id when the name normalizes to empty", () => {
    expect(identityKey(ch({ id: "ch-4k", name: "4K", countries: ["US"] }))).toBe("name:ch-4k|US");
  });
});

describe("mergeSources", () => {
  it("unions stream URLs for the same tvg-id across sources, deduped + capped", () => {
    const a = [ch({ id: "CNN.us", streamUrls: ["https://1"] })];
    const b = [ch({ id: "CNN.us", streamUrls: ["https://2", "https://1"] })];
    const c = [ch({ id: "CNN.us", streamUrls: ["https://3"] })];
    const d = [ch({ id: "CNN.us", streamUrls: ["https://4"] })];
    const e = [ch({ id: "CNN.us", streamUrls: ["https://5"] })];
    const out = mergeSources([a, b, c, d, e]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2", "https://3", "https://4"]); // cap 4
  });

  it("merges by normalized name + same country", () => {
    const a = [ch({ id: "espn-slug", name: "ESPN", countries: ["US"], streamUrls: ["https://1"] })];
    const b = [ch({ id: "espn2", name: "ESPN HD", countries: ["US"], streamUrls: ["https://2"] })];
    const out = mergeSources([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("does NOT merge same name across different countries", () => {
    const a = [ch({ id: "s1", name: "Sport", countries: ["US"] })];
    const b = [ch({ id: "s2", name: "Sport", countries: ["GB"] })];
    expect(mergeSources([a, b])).toHaveLength(2);
  });

  it("unions grouped backups within a single source", () => {
    const a = [
      ch({ id: "CNN.us", streamUrls: ["https://1"] }),
      ch({ id: "CNN.us", streamUrls: ["https://2"] }),
    ];
    const out = mergeSources([a]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("unwraps a third-party proxy before union (wrapped + underlying collapse)", () => {
    const a = [ch({ id: "CNN.us", streamUrls: ["https://cors-proxy.cooks.fyi/http://x/a"] })];
    const b = [ch({ id: "CNN.us", streamUrls: ["http://x/a"] })];
    const out = mergeSources([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["http://x/a"]);
  });

  it("adds unmatched channels as new entries", () => {
    const a = [ch({ id: "A.us" })];
    const b = [ch({ id: "B.us" })];
    expect(mergeSources([a, b])).toHaveLength(2);
  });

  it("first source wins metadata; later sources fill only missing fields", () => {
    const a = [ch({ id: "CNN.us", logo: "first.png", category: "News", languages: ["English"], countries: ["US"] })];
    const b = [ch({ id: "CNN.us", logo: "second.png", category: "Sports", languages: ["French"], countries: ["FR"] })];
    const out = mergeSources([a, b]);
    expect(out[0]).toMatchObject({ logo: "first.png", category: "News", languages: ["English"], countries: ["US"] });
  });

  it("fills a missing field from a later source", () => {
    const a = [ch({ id: "CNN.us", logo: "", category: "Other", languages: [], countries: [] })];
    const b = [ch({ id: "CNN.us", logo: "got.png", category: "News", languages: ["English"], countries: ["US"] })];
    const out = mergeSources([a, b]);
    expect(out[0]).toMatchObject({ logo: "got.png", category: "News", languages: ["English"], countries: ["US"] });
  });
});
