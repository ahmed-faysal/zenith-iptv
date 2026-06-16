import { describe, it, expect, beforeEach } from "vitest";
import {
  getFavorites, toggleFavorite, isFavorite,
  getRecents, pushRecent,
  getLastChannel, setLastChannel,
  getPrefs, setPrefs,
} from "@/lib/storage";

beforeEach(() => localStorage.clear());

describe("favorites", () => {
  it("toggles on and off", () => {
    expect(isFavorite("a")).toBe(false);
    toggleFavorite("a");
    expect(isFavorite("a")).toBe(true);
    expect(getFavorites()).toEqual(["a"]);
    toggleFavorite("a");
    expect(isFavorite("a")).toBe(false);
  });
});

describe("recents", () => {
  it("keeps most-recent-first and de-dupes", () => {
    pushRecent("a");
    pushRecent("b");
    pushRecent("a");
    expect(getRecents()).toEqual(["a", "b"]);
  });
  it("caps at 10", () => {
    for (let i = 0; i < 15; i++) pushRecent("c" + i);
    expect(getRecents()).toHaveLength(10);
    expect(getRecents()[0]).toBe("c14");
  });
});

describe("last channel + prefs", () => {
  it("round-trips last channel", () => {
    expect(getLastChannel()).toBeNull();
    setLastChannel("x");
    expect(getLastChannel()).toBe("x");
  });
  it("round-trips prefs with defaults", () => {
    expect(getPrefs()).toEqual({ languages: [], countries: [] });
    setPrefs({ languages: ["English"], countries: ["GB"] });
    expect(getPrefs()).toEqual({ languages: ["English"], countries: ["GB"] });
  });
});
