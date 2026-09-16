import { describe, it, expect } from "vitest";
import { toChannelsXml, scopeChannelIds, BLOCKED_SITES, type GuideEntry } from "@/lib/epg-channels";

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

describe("scopeChannelIds", () => {
  const channels = [
    { id: "BBCNews.uk@HD", name: "BBC News", logo: "", streamUrls: [], category: "News", languages: [], countries: ["UK"] },
    { id: "CNN.us@SD", name: "CNN", logo: "", streamUrls: [], category: "News", languages: [], countries: ["US"] },
    { id: "Sky.uk@HD", name: "Sky", logo: "", streamUrls: [], category: "News", languages: [], countries: ["UK"] },
  ];

  it("scopes to every channel's base id when no country filter is given", () => {
    expect(scopeChannelIds(channels, [])).toEqual(new Set(["BBCNews.uk", "CNN.us", "Sky.uk"]));
  });

  it("strips the @feed suffix so ids match guides.json's base xmltv_id", () => {
    expect(scopeChannelIds(channels, [])).not.toContain("BBCNews.uk@HD");
  });

  it("narrows to only channels in the given countries", () => {
    expect(scopeChannelIds(channels, ["UK"])).toEqual(new Set(["BBCNews.uk", "Sky.uk"]));
  });

  it("matches country codes case-insensitively", () => {
    expect(scopeChannelIds(channels, ["uk"])).toEqual(new Set(["BBCNews.uk", "Sky.uk"]));
  });
});

describe("blocked grabber sites", () => {
  const withBad: GuideEntry[] = [
    { channel: "BBCNews.uk", site: "bbc.co.uk", site_id: "b1", lang: "en" },
    { channel: "BBCNews.uk", site: "tv.mail.ru", site_id: "m1", lang: "ru" },
  ];

  it("lists tv.mail.ru as blocked (its config crashes the whole grab)", () => {
    expect(BLOCKED_SITES.has("tv.mail.ru")).toBe(true);
  });

  it("omits rows from blocked sites by default", () => {
    const xml = toChannelsXml(withBad, new Set(["BBCNews.uk"]));
    expect(xml).toContain('site="bbc.co.uk"');
    expect(xml).not.toContain("tv.mail.ru");
  });

  it("keeps the channel as long as one non-blocked site remains", () => {
    const xml = toChannelsXml(withBad, new Set(["BBCNews.uk"]));
    expect(xml.match(/<channel /g)).toHaveLength(1);
  });

  it("accepts an explicit block set, overriding the default", () => {
    const xml = toChannelsXml(withBad, new Set(["BBCNews.uk"]), new Set(["bbc.co.uk"]));
    expect(xml).toContain("tv.mail.ru");
    expect(xml).not.toContain('site="bbc.co.uk"');
  });
});
