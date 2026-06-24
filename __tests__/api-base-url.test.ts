import { describe, it, expect, vi, beforeEach } from "vitest";

describe("NEXT_PUBLIC_API_BASE prefix", () => {
  beforeEach(() => { vi.unstubAllEnvs(); });

  it("channels defaultFetcher prepends NEXT_PUBLIC_API_BASE when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "https://example.com");
    // Re-import so the module picks up the new env value
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: [] })),
    );
    const { loadChannels } = await import("@/lib/channels-client");
    await loadChannels();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/api/channels"),
    );
    fetchSpy.mockRestore();
  });

  it("channels defaultFetcher uses relative path when NEXT_PUBLIC_API_BASE is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE", "");
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: [] })),
    );
    const { loadChannels } = await import("@/lib/channels-client");
    await loadChannels();
    expect(fetchSpy).toHaveBeenCalledWith("/api/channels");
    fetchSpy.mockRestore();
  });
});
