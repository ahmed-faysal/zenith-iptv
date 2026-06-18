import { describe, it, expect } from "vitest";
import { parseXmltvDate, parseXmltv, buildGuide, nowNext, baseChannelId } from "@/lib/epg";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="BBCNews.uk"><display-name>BBC News</display-name></channel>
  <programme start="20260618120000 +0000" stop="20260618130000 +0000" channel="BBCNews.uk">
    <title lang="en">BBC News at One</title>
  </programme>
  <programme start="20260618130000 +0000" stop="20260618140000 +0000" channel="BBCNews.uk">
    <title>Politics &amp; Co</title>
  </programme>
  <programme start="20260618120000 +0100" stop="20260618123000 +0100" channel="Sky.uk">
    <title>Sky Lunch</title>
  </programme>
</tv>`;

describe("baseChannelId", () => {
  it("strips an @feed suffix to the base xmltv_id (how EPG keys channels)", () => {
    expect(baseChannelId("1Plus1International.ua@HD")).toBe("1Plus1International.ua");
    expect(baseChannelId("123tv.de@SD")).toBe("123tv.de");
  });
  it("leaves ids without an @feed unchanged", () => {
    expect(baseChannelId("BBCNews.uk")).toBe("BBCNews.uk");
    expect(baseChannelId("00s-replay")).toBe("00s-replay");
  });
});

describe("parseXmltvDate", () => {
  it("parses a UTC timestamp to epoch ms", () => {
    expect(parseXmltvDate("20260618120000 +0000")).toBe(Date.UTC(2026, 5, 18, 12, 0, 0));
  });
  it("applies a positive timezone offset", () => {
    // 12:00 at +0100 is 11:00 UTC
    expect(parseXmltvDate("20260618120000 +0100")).toBe(Date.UTC(2026, 5, 18, 11, 0, 0));
  });
  it("defaults to UTC when no offset is present", () => {
    expect(parseXmltvDate("20260618120000")).toBe(Date.UTC(2026, 5, 18, 12, 0, 0));
  });
  it("returns NaN for garbage", () => {
    expect(Number.isNaN(parseXmltvDate("nonsense"))).toBe(true);
  });
});

describe("parseXmltv", () => {
  it("extracts programmes with channel, times and title (entities decoded)", () => {
    const progs = parseXmltv(SAMPLE);
    expect(progs).toHaveLength(3);
    const first = progs[0];
    expect(first.channel).toBe("BBCNews.uk");
    expect(first.title).toBe("BBC News at One");
    expect(first.start).toBe(Date.UTC(2026, 5, 18, 12, 0, 0));
    expect(first.stop).toBe(Date.UTC(2026, 5, 18, 13, 0, 0));
    expect(progs[1].title).toBe("Politics & Co");
  });
});

describe("buildGuide", () => {
  it("groups programmes by channel id, sorted by start", () => {
    const guide = buildGuide(SAMPLE);
    expect([...guide.keys()].sort()).toEqual(["BBCNews.uk", "Sky.uk"]);
    expect(guide.get("BBCNews.uk")).toHaveLength(2);
    expect(guide.get("BBCNews.uk")![0].start).toBeLessThan(guide.get("BBCNews.uk")![1].start);
  });
});

describe("nowNext", () => {
  const progs = buildGuide(SAMPLE).get("BBCNews.uk")!;
  it("returns the current programme as now and the following as next", () => {
    const at = Date.UTC(2026, 5, 18, 12, 30, 0);
    const { now, next } = nowNext(progs, at);
    expect(now?.title).toBe("BBC News at One");
    expect(next?.title).toBe("Politics & Co");
  });
  it("has no now before the schedule starts, but reports the first as next", () => {
    const at = Date.UTC(2026, 5, 18, 11, 0, 0);
    const { now, next } = nowNext(progs, at);
    expect(now).toBeUndefined();
    expect(next?.title).toBe("BBC News at One");
  });
  it("has no now or next after the schedule ends", () => {
    const at = Date.UTC(2026, 5, 18, 15, 0, 0);
    const { now, next } = nowNext(progs, at);
    expect(now).toBeUndefined();
    expect(next).toBeUndefined();
  });
});
