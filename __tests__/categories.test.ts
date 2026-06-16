import { describe, it, expect } from "vitest";
import { toAppCategory } from "@/lib/categories";

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
