import { describe, it, expect, vi } from "vitest";
import { createChannelSource } from "@/lib/source";

const M3U = `#EXTM3U
#EXTINF:-1 tvg-id="A.x" group-title="News",A
http://x/a.m3u8
`;

// Single-source fixture to keep these tests focused on fetch + cache behaviour.
const ONE_SOURCE = [{ label: "test", url: "http://test/playlist.m3u" }];

describe("createChannelSource", () => {
  it("fetches and parses channels", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    const getChannels = createChannelSource(fetcher, ONE_SOURCE);
    const channels = await getChannels();
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("A");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("serves from cache on second call", async () => {
    const fetcher = vi.fn().mockResolvedValue(M3U);
    const getChannels = createChannelSource(fetcher, ONE_SOURCE);
    await getChannels();
    await getChannels();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
