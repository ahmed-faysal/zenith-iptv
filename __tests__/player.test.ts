import { describe, it, expect } from "vitest";
import { formatClock, qualityLabel, hlsConfig, planRecovery, MAX_RECOVERY } from "@/lib/player";

describe("planRecovery", () => {
  const fresh = () => ({ network: 0, media: 0 });

  it("restarts loading on a network fatal, counting the attempt", () => {
    const r = planRecovery("network", fresh());
    expect(r.action).toBe("restartLoad");
    expect(r.state).toEqual({ network: 1, media: 0 });
  });
  it("recovers media on a media fatal, counting the attempt", () => {
    const r = planRecovery("media", fresh());
    expect(r.action).toBe("recoverMedia");
    expect(r.state).toEqual({ network: 0, media: 1 });
  });
  it("gives up on a network fatal once the cap is reached", () => {
    const r = planRecovery("network", { network: MAX_RECOVERY, media: 0 });
    expect(r.action).toBe("giveUp");
    expect(r.state).toEqual({ network: MAX_RECOVERY, media: 0 }); // unchanged
  });
  it("gives up on a media fatal once the cap is reached", () => {
    const r = planRecovery("media", { network: 0, media: MAX_RECOVERY });
    expect(r.action).toBe("giveUp");
  });
  it("gives up immediately on an other/unknown fatal", () => {
    expect(planRecovery("other", fresh()).action).toBe("giveUp");
  });
  it("tracks network and media budgets independently", () => {
    // network exhausted, media still has budget
    const r = planRecovery("media", { network: MAX_RECOVERY, media: 0 });
    expect(r.action).toBe("recoverMedia");
  });
});

describe("hlsConfig", () => {
  it("caps the back-buffer so long sessions don't grow unbounded in RAM", () => {
    // hls.js defaults backBufferLength to Infinity, which leaks memory on a TV
    // left running for hours. 30s is plenty for live playback.
    expect(hlsConfig().backBufferLength).toBe(30);
  });
  it("caps ABR to the rendered player size to avoid wasting bandwidth", () => {
    expect(hlsConfig().capLevelToPlayerSize).toBe(true);
  });
  it("returns a fresh object each call (hls.js may mutate its config)", () => {
    expect(hlsConfig()).not.toBe(hlsConfig());
  });
});

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
