import { describe, it, expect } from "vitest";
import { toChannelsXml, type GuideEntry } from "@/lib/epg-channels";

const guides: GuideEntry[] = [
  { channel: "BBCNews.uk", site: "bbc.co.uk", site_id: "b1", lang: "en" },
  { channel: "Sky.uk", site: "sky.com", site_id: "s&1", lang: "en" },
  { channel: "CNN.us", site: "cnn.com", site_id: "c1", lang: "en" },
];

describe("toChannelsXml", () => {
  it("emits a <channel> only for ids in our set", () => {
    const xml = toChannelsXml(guides, new Set(["BBCNews.uk", "Sky.uk"]));
    expect(xml).toContain('xmltv_id="BBCNews.uk"');
    expect(xml).toContain('xmltv_id="Sky.uk"');
    expect(xml).not.toContain("CNN.us");
  });

  it("includes the grabber attributes (site, lang, site_id)", () => {
    const xml = toChannelsXml(guides, new Set(["BBCNews.uk"]));
    expect(xml).toContain('site="bbc.co.uk"');
    expect(xml).toContain('lang="en"');
    expect(xml).toContain('site_id="b1"');
  });

  it("escapes special characters in attribute values", () => {
    const xml = toChannelsXml(guides, new Set(["Sky.uk"]));
    expect(xml).toContain('site_id="s&amp;1"');
    expect(xml).not.toContain('site_id="s&1"');
  });

  it("wraps entries in a <channels> root with an xml declaration", () => {
    const xml = toChannelsXml(guides, new Set(["BBCNews.uk"]));
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<channels>");
    expect(xml).toContain("</channels>");
  });

  it("returns an empty channels document when nothing matches", () => {
    const xml = toChannelsXml(guides, new Set(["nope"]));
    expect(xml).toContain("<channels>");
    expect(xml).not.toContain("<channel ");
  });

  it("dedupes identical channel+site+site_id rows", () => {
    const dupes = [guides[0], { ...guides[0] }];
    const xml = toChannelsXml(dupes, new Set(["BBCNews.uk"]));
    expect(xml.match(/<channel /g)).toHaveLength(1);
  });
});
