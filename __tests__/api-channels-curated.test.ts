import { describe, it, expect, vi } from "vitest";

// Serve a known curated payload regardless of the on-disk seed.
vi.mock("@/data/curated.json", () => ({
  default: {
    generatedAt: "2026-06-30T12:00:00.000Z",
    summary: { candidates: 1, fastProbePassed: 1, playable: 1 },
    channels: [
      { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["https://a/1.m3u8"],
        category: "News", languages: ["English"], countries: ["US"] },
    ],
  },
}));

import { GET } from "@/app/api/channels/route";

describe("/api/channels (curated-only)", () => {
  it("serves the curated channels", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].id).toBe("CNN.us");
  });
  it("keeps the CORS and cache headers", async () => {
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});
