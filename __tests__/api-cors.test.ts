import { describe, it, expect, vi } from "vitest";
import { GET as channelsGET } from "@/app/api/channels/route";
import { GET as epgGET } from "@/app/api/epg/route";

vi.mock("@/lib/source", () => ({
  getChannels: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/epg-source", () => ({
  getGuide: vi.fn().mockResolvedValue(new Map()),
}));

describe("API CORS headers", () => {
  it("/api/channels returns Access-Control-Allow-Origin: *", async () => {
    const res = await channelsGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("/api/epg returns Access-Control-Allow-Origin: *", async () => {
    const res = await epgGET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
