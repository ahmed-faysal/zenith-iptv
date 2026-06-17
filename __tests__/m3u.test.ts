import { describe, it, expect } from "vitest";
import { parseM3U } from "@/lib/m3u";

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="BBCNews.uk" tvg-logo="http://logo/bbc.png" group-title="News" tvg-language="English" tvg-country="GB",BBC News
http://example.com/bbc.m3u8
#EXTINF:-1 tvg-id="ESPN.us" tvg-logo="http://logo/espn.png" group-title="Sports" tvg-language="English" tvg-country="US",ESPN
http://example.com/espn.m3u8
`;

describe("parseM3U", () => {
  it("parses two channels", () => {
    const channels = parseM3U(SAMPLE);
    expect(channels).toHaveLength(2);
  });
  it("extracts name, logo, stream url", () => {
    const [bbc] = parseM3U(SAMPLE);
    expect(bbc.name).toBe("BBC News");
    expect(bbc.logo).toBe("http://logo/bbc.png");
    expect(bbc.streamUrl).toBe("http://example.com/bbc.m3u8");
  });
  it("derives id, category, languages, countries", () => {
    const [bbc] = parseM3U(SAMPLE);
    expect(bbc.id).toBe("BBCNews.uk");
    expect(bbc.category).toBe("News");
    expect(bbc.languages).toEqual(["English"]);
    expect(bbc.countries).toEqual(["GB"]);
  });
  it("skips entries without a stream url", () => {
    const broken = `#EXTM3U\n#EXTINF:-1,No URL Channel\n`;
    expect(parseM3U(broken)).toHaveLength(0);
  });
  it("falls back to a generated id when tvg-id is missing", () => {
    const noId = `#EXTM3U\n#EXTINF:-1 group-title="News",Some Channel\nhttp://x/y.m3u8\n`;
    expect(parseM3U(noId)[0].id).toBe("some-channel");
  });
  it("de-duplicates channels that share an id, keeping the first", () => {
    // iptv-org lists some channels several times (same tvg-id, different source).
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="CNN.us" group-title="News",CNN One
http://x/1.m3u8
#EXTINF:-1 tvg-id="CNN.us" group-title="News",CNN Two
http://x/2.m3u8
`;
    const ch = parseM3U(m3u);
    expect(ch).toHaveLength(1);
    expect(ch[0].name).toBe("CNN One");
  });
  it("generates distinct, non-empty ids for non-Latin names", () => {
    // Both names slugged to "576p" under an ASCII-only slug, colliding.
    const m3u = `#EXTM3U
#EXTINF:-1 tvg-id="" group-title="Undefined",交城電視台 (576p)
http://x/a.m3u8
#EXTINF:-1 tvg-id="" group-title="Undefined",京视剧场 (576p)
http://x/b.m3u8
`;
    const ch = parseM3U(m3u);
    expect(ch).toHaveLength(2);
    expect(ch[0].id).not.toBe("");
    expect(ch[1].id).not.toBe("");
    expect(ch[0].id).not.toBe(ch[1].id);
  });
});
