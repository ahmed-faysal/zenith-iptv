import { describe, it, expect, vi } from "vitest";
import { createChannelLoader } from "@/lib/channels-client";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "a", name: "A", logo: "", streamUrl: "http://x/a",
  category: "News", languages: [], countries: [],
};

describe("createChannelLoader", () => {
  it("fetches channels on the first call", async () => {
    const fetcher = vi.fn().mockResolvedValue([ch]);
    const load = createChannelLoader(fetcher);
    expect(await load()).toEqual([ch]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves from cache on subsequent calls (fetch once per session)", async () => {
    const fetcher = vi.fn().mockResolvedValue([ch]);
    const load = createChannelLoader(fetcher);
    await load();
    await load();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("clears the cache on failure so a retry can refetch", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([ch]);
    const load = createChannelLoader(fetcher);
    await expect(load()).rejects.toThrow("network");
    expect(await load()).toEqual([ch]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
