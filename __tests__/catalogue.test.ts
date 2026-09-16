import { describe, it, expect } from "vitest";
import { resolveCatalogue } from "@/lib/catalogue";
import type { Channel } from "@/lib/types";

const ch = (id: string): Channel => ({
  id, name: id, logo: "", streamUrls: [`https://x/${id}.m3u8`],
  category: "News", languages: [], countries: [], quality: null,
});

describe("resolveCatalogue", () => {
  it("serves the curated list when it has channels", async () => {
    const live = async () => [ch("live")];
    expect(await resolveCatalogue([ch("curated")], live)).toEqual([ch("curated")]);
  });

  it("falls back to the live merge when curated is empty", async () => {
    const live = async () => [ch("live")];
    expect(await resolveCatalogue([], live)).toEqual([ch("live")]);
  });

  it("returns empty rather than throwing when the live fallback also fails", async () => {
    const live = async () => { throw new Error("all playlist sources failed"); };
    expect(await resolveCatalogue([], live)).toEqual([]);
  });
});
