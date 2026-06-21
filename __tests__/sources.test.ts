import { describe, it, expect } from "vitest";
import { SOURCES, applyDefaults, type Source } from "@/lib/sources";
import type { Channel } from "@/lib/types";

const ch = (o: Partial<Channel>): Channel => ({
  id: "X", name: "X", logo: "", streamUrls: ["https://x"],
  category: "Other", languages: [], countries: [], quality: null, ...o,
});

describe("SOURCES", () => {
  it("lists iptv-org first as the canonical spine", () => {
    expect(SOURCES[0].label).toBe("iptv-org");
    expect(SOURCES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("applyDefaults", () => {
  const src: Source = { label: "t", url: "u", country: "JP", language: "Japanese", category: "News" };

  it("fills country/language/category when the entry lacks them", () => {
    const out = applyDefaults([ch({ countries: [], languages: [], category: "Other" })], src);
    expect(out[0]).toMatchObject({ countries: ["JP"], languages: ["Japanese"], category: "News" });
  });

  it("never overrides values the entry already has", () => {
    const out = applyDefaults(
      [ch({ countries: ["US"], languages: ["English"], category: "Sports" })],
      src,
    );
    expect(out[0]).toMatchObject({ countries: ["US"], languages: ["English"], category: "Sports" });
  });

  it("is a no-op when the source declares no defaults", () => {
    const bare: Source = { label: "b", url: "u" };
    const input = ch({ countries: [], languages: [], category: "Other" });
    expect(applyDefaults([input], bare)[0]).toMatchObject({ countries: [], languages: [], category: "Other" });
  });
});
