import { describe, it, expect } from "vitest";
import { formatClock, qualityLabel } from "@/lib/player";

describe("formatClock", () => {
  it("formats midnight as 12:xx AM", () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 43))).toBe("12:43 AM");
  });
  it("formats noon as 12:xx PM", () => {
    expect(formatClock(new Date(2026, 0, 1, 12, 43))).toBe("12:43 PM");
  });
  it("zero-pads minutes", () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe("9:05 AM");
  });
  it("converts afternoon hours to 12-hour", () => {
    expect(formatClock(new Date(2026, 0, 1, 13, 9))).toBe("1:09 PM");
  });
});

describe("qualityLabel", () => {
  it("is Auto when no explicit level is chosen", () => {
    expect(qualityLabel([], -1)).toBe("Auto");
    expect(qualityLabel([{ height: 1080 }, { height: 720 }], -1)).toBe("Auto");
  });
  it("shows the chosen level's resolution", () => {
    expect(qualityLabel([{ height: 1080 }, { height: 720 }], 0)).toBe("1080p");
    expect(qualityLabel([{ height: 1080 }, { height: 720 }], 1)).toBe("720p");
  });
  it("falls back to Auto for an out-of-range index", () => {
    expect(qualityLabel([{ height: 1080 }], 5)).toBe("Auto");
  });
});
