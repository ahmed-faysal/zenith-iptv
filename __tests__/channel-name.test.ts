import { describe, it, expect } from "vitest";
import { parseChannelName } from "@/lib/channel-name";

describe("parseChannelName", () => {
  it("returns the name unchanged when there are no tags", () => {
    expect(parseChannelName("ABC Kids")).toEqual({
      title: "ABC Kids",
      quality: null,
      flags: [],
    });
  });

  it("pulls a trailing (1080p) resolution out as quality", () => {
    expect(parseChannelName("3Cat Plats bruts (1080p)")).toEqual({
      title: "3Cat Plats bruts",
      quality: "1080p",
      flags: [],
    });
  });

  it("handles interlaced resolutions like (576i)", () => {
    expect(parseChannelName("2x2 (576i)")).toEqual({
      title: "2x2",
      quality: "576i",
      flags: [],
    });
  });

  it("extracts bracketed status flags", () => {
    expect(parseChannelName("4DmásNoticias TV (1080p) [Not 24/7]")).toEqual({
      title: "4DmásNoticias TV",
      quality: "1080p",
      flags: ["Not 24/7"],
    });
  });

  it("extracts multiple flags and keeps quality", () => {
    expect(parseChannelName("3Cat Exclusiu 1 (1080p) [Geo-blocked]")).toEqual({
      title: "3Cat Exclusiu 1",
      quality: "1080p",
      flags: ["Geo-blocked"],
    });
  });

  it("does not treat a resolution mid-name as a quality tag", () => {
    // only a trailing (…p)/(…i) parenthetical is the quality
    expect(parseChannelName("Studio 1080 News")).toEqual({
      title: "Studio 1080 News",
      quality: null,
      flags: [],
    });
  });

  it("tags 720p and above as HD via isHd", () => {
    const a = parseChannelName("A Spor (1080p)");
    const b = parseChannelName("6 TV Telugu (576p)");
    expect(a.quality).toBe("1080p");
    expect(b.quality).toBe("576p");
  });
});
