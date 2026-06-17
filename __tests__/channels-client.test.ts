import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadChannels, __resetChannelsCache } from "@/lib/channels-client";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "a", name: "A", logo: "", streamUrl: "http://x/a",
  category: "News", languages: [], countries: [],
};

beforeEach(() => __resetChannelsCache());

describe("loadChannels", () => {
  it("fetches channels on the first call", async () => {
    const fetcher = vi.fn().mockResolvedValue([ch]);
    const result = await loadChannels(fetcher);
    expect(result).toEqual([ch]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves from cache on subsequent calls (fetch once per session)", async () => {
    const fetcher = vi.fn().mockResolvedValue([ch]);
    await loadChannels(fetcher);
    await loadChannels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("clears the cache on failure so a retry can refetch", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([ch]);
    await expect(loadChannels(fetcher)).rejects.toThrow("network");
    const result = await loadChannels(fetcher);
    expect(result).toEqual([ch]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
