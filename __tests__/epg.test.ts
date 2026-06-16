import { describe, it, expect } from "vitest";
import { parseEpgForChannel } from "@/lib/epg";

const XML = `<?xml version="1.0"?>
<tv>
  <programme start="20260616080000 +0000" stop="20260616090000 +0000" channel="BBCNews.uk">
    <title>Breakfast</title>
  </programme>
  <programme start="20260616090000 +0000" stop="20260616100000 +0000" channel="BBCNews.uk">
    <title>Morning News</title>
  </programme>
  <programme start="20260616080000 +0000" stop="20260616090000 +0000" channel="ESPN.us">
    <title>SportsCenter</title>
  </programme>
</tv>`;

const NOW = new Date("2026-06-16T08:30:00Z");

describe("parseEpgForChannel", () => {
  it("returns now and next for a channel", () => {
    const entry = parseEpgForChannel(XML, "BBCNews.uk", NOW);
    expect(entry.now?.title).toBe("Breakfast");
    expect(entry.next?.title).toBe("Morning News");
  });
  it("returns empty object for unknown channel", () => {
    const entry = parseEpgForChannel(XML, "Unknown.xx", NOW);
    expect(entry.now).toBeUndefined();
    expect(entry.next).toBeUndefined();
  });
});
