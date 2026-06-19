import { describe, it, expect } from "vitest";
import { toAppCategory, canonicalCategory } from "@/lib/categories";

describe("toAppCategory", () => {
  it("maps news groups", () => {
    expect(toAppCategory(["News"])).toBe("News");
    expect(toAppCategory(["Politics", "News"])).toBe("News");
  });
  it("maps sports", () => {
    expect(toAppCategory(["Sports"])).toBe("Sports");
  });
  it("maps movies and series to Entertainment", () => {
    expect(toAppCategory(["Movies"])).toBe("Entertainment");
    expect(toAppCategory(["Series"])).toBe("Entertainment");
  });
  it("maps music", () => {
    expect(toAppCategory(["Music"])).toBe("Music");
  });
  it("maps kids", () => {
    expect(toAppCategory(["Kids"])).toBe("Kids");
  });
  it("falls back to Other for unknown or empty", () => {
    expect(toAppCategory(["Weather"])).toBe("Other");
    expect(toAppCategory([])).toBe("Other");
  });
});

describe("canonicalCategory", () => {
  it("maps known canonical ids to AppCategory", () => {
    expect(canonicalCategory(["news"])).toBe("News");
    expect(canonicalCategory(["sports"])).toBe("Sports");
    expect(canonicalCategory(["music"])).toBe("Music");
    expect(canonicalCategory(["kids"])).toBe("Kids");
    expect(canonicalCategory(["movies"])).toBe("Entertainment");
  });
  it("applies priority when multiple categories are present", () => {
    // News outranks Entertainment; Kids outranks Music
    expect(canonicalCategory(["entertainment", "news"])).toBe("News");
    expect(canonicalCategory(["music", "kids"])).toBe("Kids");
  });
  it("returns Other when categories exist but none map to a named bucket", () => {
    expect(canonicalCategory(["business", "shop"])).toBe("Other");
  });
  it("returns undefined when there are no categories (use keyword fallback)", () => {
    expect(canonicalCategory([])).toBeUndefined();
  });
});
