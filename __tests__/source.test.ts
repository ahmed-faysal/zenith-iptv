import { describe, it, expect, vi } from "vitest";
import { createChannelSource } from "@/lib/source";
import type { Source } from "@/lib/sources";

const SRC = (label: string, url: string, extra: Partial<Source> = {}): Source => ({ label, url, ...extra });

// Minimal M3U for one channel with a given tvg-id and url.
const m3u = (id: string, url: string, name = id) =>
  `#EXTM3U\n#EXTINF:-1 tvg-id="${id}",${name}\n${url}\n`;

describe("createChannelSource (multi-source)", () => {
  it("merges the same channel across sources into unioned streamUrls", async () => {
    const sources = [SRC("a", "urlA"), SRC("b", "urlB")];
    const fetcher = vi.fn(async (url: string) =>
      url === "urlA" ? m3u("CNN.us", "https://1") : m3u("CNN.us", "https://2"),
    );
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels).toHaveLength(1);
    expect(channels[0].streamUrls).toEqual(["https://1", "https://2"]);
  });

  it("skips a failing source instead of breaking the catalogue", async () => {
    const sources = [SRC("good", "ok"), SRC("bad", "boom")];
    const fetcher = vi.fn(async (url: string) => {
      if (url === "boom") throw new Error("404");
      return m3u("A.us", "https://1");
    });
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe("A.us");
  });

  it("throws only when every source fails", async () => {
    const sources = [SRC("a", "x"), SRC("b", "y")];
    const fetcher = vi.fn(async () => { throw new Error("down"); });
    const load = createChannelSource(fetcher, sources);
    await expect(load()).rejects.toThrow(/all playlist sources failed/);
  });

  it("applies per-source metadata defaults", async () => {
    const sources = [SRC("jp", "u", { country: "JP", language: "Japanese" })];
    const fetcher = vi.fn(async () => m3u("somejp", "https://1", "Some JP Channel"));
    const load = createChannelSource(fetcher, sources);
    const channels = await load();
    expect(channels[0]).toMatchObject({ countries: ["JP"], languages: ["Japanese"] });
  });
});
