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
});
