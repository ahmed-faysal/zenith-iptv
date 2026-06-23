import { describe, it, expect } from "vitest";
import { searchChannels, searchProgrammes } from "@/lib/search";
import type { Channel } from "@/lib/types";
import type { EpgMap } from "@/hooks/useEpg";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrls: ["http://x/" + id], category: "News",
  languages: [], countries: [],
});
const list = [
  make("a", "BBC News"),
  make("b", "BBC World"),
  make("c", "CNN International"),
  make("d", "Al Jazeera"),
];

describe("searchChannels", () => {
  it("returns an empty list for a blank query", () => {
    expect(searchChannels(list, "")).toEqual([]);
    expect(searchChannels(list, "   ")).toEqual([]);
  });

  it("matches case-insensitively on a substring of the name", () => {
    const r = searchChannels(list, "bbc");
    expect(r.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("matches mid-name substrings", () => {
    expect(searchChannels(list, "jazeera").map((c) => c.id)).toEqual(["d"]);
  });

  it("trims surrounding whitespace from the query", () => {
    expect(searchChannels(list, "  cnn  ").map((c) => c.id)).toEqual(["c"]);
  });

  it("caps the number of results at the given limit", () => {
    const many = Array.from({ length: 100 }, (_, i) => make("n" + i, "News " + i));
    expect(searchChannels(many, "news", 60)).toHaveLength(60);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchChannels(list, "zzz")).toEqual([]);
  });
});

const epgMap: EpgMap = {
  "a": { now: { channel: "a", start: 0, stop: 9999999999999, title: "World Cup Final" } },
  "b": { next: { channel: "b", start: 9999999999999, stop: 9999999999999 + 3600000, title: "F1 Race Highlights" } },
  "c": { now: { channel: "c", start: 0, stop: 9999999999999, title: "World Cup Draw" }, next: { channel: "c", start: 9999999999999, stop: 9999999999999 + 3600000, title: "Match Preview" } },
  "d": {},
};

describe("searchProgrammes", () => {
  it("returns empty list for blank query", () => {
    expect(searchProgrammes(epgMap, list, "", new Set())).toEqual([]);
    expect(searchProgrammes(epgMap, list, "   ", new Set())).toEqual([]);
  });

  it("matches now.title case-insensitively", () => {
    const r = searchProgrammes(epgMap, list, "world cup", new Set());
    expect(r.map((x) => x.channel.id)).toContain("a");
    expect(r.find((x) => x.channel.id === "a")?.subtitle).toBe("Now · World Cup Final");
  });

  it("matches next.title when now does not match", () => {
    const r = searchProgrammes(epgMap, list, "f1", new Set());
    expect(r.map((x) => x.channel.id)).toContain("b");
    expect(r.find((x) => x.channel.id === "b")?.subtitle).toBe("Next · F1 Race Highlights");
  });

  it("prefers now over next when both match", () => {
    const r = searchProgrammes(epgMap, list, "world cup", new Set());
    expect(r.find((x) => x.channel.id === "c")?.subtitle).toBe("Now · World Cup Draw");
  });

  it("excludes channel ids in the exclude set", () => {
    const r = searchProgrammes(epgMap, list, "world cup", new Set(["a", "c"]));
    expect(r.map((x) => x.channel.id)).not.toContain("a");
    expect(r.map((x) => x.channel.id)).not.toContain("c");
  });

  it("skips channels with no EPG entry silently", () => {
    const r = searchProgrammes(epgMap, list, "al jazeera", new Set());
    expect(r.map((x) => x.channel.id)).not.toContain("d");
  });

  it("caps results at the given limit", () => {
    const bigEpg: EpgMap = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [
        "n" + i,
        { now: { channel: "n" + i, start: 0, stop: 9999999999999, title: "News Live" } },
      ])
    );
    const bigList = Array.from({ length: 50 }, (_, i) => make("n" + i, "Channel " + i));
    expect(searchProgrammes(bigEpg, bigList, "news", new Set(), 10)).toHaveLength(10);
  });

  it("matches mixed-case query", () => {
    const r = searchProgrammes(epgMap, list, "WORLD CUP", new Set());
    expect(r.map((x) => x.channel.id)).toContain("a");
  });
});
