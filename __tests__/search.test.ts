import { describe, it, expect } from "vitest";
import { searchChannels } from "@/lib/search";
import type { Channel } from "@/lib/types";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrl: "http://x/" + id, category: "News",
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
