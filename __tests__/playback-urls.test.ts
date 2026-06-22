import { describe, it, expect } from "vitest";
import { httpsUpgrade, unwrapProxy, expandPlaybackUrls } from "@/lib/playback-urls";

describe("httpsUpgrade", () => {
  it("upgrades http to https", () => {
    expect(httpsUpgrade("http://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
  it("leaves https untouched", () => {
    expect(httpsUpgrade("https://a/b.m3u8")).toBe("https://a/b.m3u8");
  });
});

describe("unwrapProxy", () => {
  it("unwraps a nested-scheme proxy (cooks.fyi)", () => {
    expect(unwrapProxy("https://cors-proxy.cooks.fyi/http://190.11.225.124:5000/a.m3u8"))
      .toBe("http://190.11.225.124:5000/a.m3u8");
  });
  it("unwraps a ?url= style proxy", () => {
    expect(unwrapProxy("https://p.example.com/?url=" + encodeURIComponent("https://real/a.m3u8")))
      .toBe("https://real/a.m3u8");
  });
  it("leaves a normal url untouched", () => {
    expect(unwrapProxy("https://real/a.m3u8")).toBe("https://real/a.m3u8");
  });
});

describe("expandPlaybackUrls", () => {
  it("proxy off: https direct, http upgraded, no proxy entries", () => {
    expect(expandPlaybackUrls(["https://a/x.m3u8", "http://b/y.m3u8"], false))
      .toEqual(["https://a/x.m3u8", "https://b/y.m3u8"]);
  });
  it("proxy on, https: [direct, proxyPath]", () => {
    expect(expandPlaybackUrls(["https://a/x.m3u8"], true))
      .toEqual(["https://a/x.m3u8", "/api/proxy?url=" + encodeURIComponent("https://a/x.m3u8")]);
  });
  it("proxy on, http: [https-upgrade, proxyPath of original http]", () => {
    expect(expandPlaybackUrls(["http://b/y.m3u8"], true))
      .toEqual(["https://b/y.m3u8", "/api/proxy?url=" + encodeURIComponent("http://b/y.m3u8")]);
  });
  it("dedupes and caps at MAX_SOURCES*2 (8)", () => {
    const urls = ["https://1","https://2","https://3","https://4","https://5"];
    const out = expandPlaybackUrls(urls, true);
    expect(out.length).toBe(8);
  });
});
