import { describe, it, expect } from "vitest";
import { topValues } from "@/lib/filters";
import type { Channel } from "@/lib/types";

let n = 0;
const make = (languages: string[]): Channel => ({
  id: `c${n++}`, name: "x", logo: "", streamUrls: [], category: "News",
  languages, countries: [],
});

describe("topValues", () => {
  it("returns values ordered by frequency, most common first", () => {
    const channels = [make(["en"]), make(["en"]), make(["es"]), make(["en"]), make(["es", "fr"])];
    // en:3, es:2, fr:1
    expect(topValues(channels, (c) => c.languages, 10)).toEqual(["en", "es", "fr"]);
  });

  it("caps the result at the limit", () => {
    const channels = [make(["a"]), make(["b"]), make(["c"]), make(["d"])];
    expect(topValues(channels, (c) => c.languages, 2)).toHaveLength(2);
  });

  it("dedupes values and ignores channels with none", () => {
    const channels = [make([]), make(["en"]), make(["en"])];
    expect(topValues(channels, (c) => c.languages, 10)).toEqual(["en"]);
  });
});
