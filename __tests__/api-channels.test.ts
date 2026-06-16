import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChannels, __resetCache } from "@/lib/source";

const M3U = `#EXTM3U
#EXTINF:-1 tvg-id="A.x" group-title="News",A
http://x/a.m3u8
`;

beforeEach(() => __resetCache());

describe("getChannels", () => {
  it("fetches and parses channels", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    const channels = await getChannels(fetcher);
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("A");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("serves from cache on second call", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    await getChannels(fetcher);
    await getChannels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
