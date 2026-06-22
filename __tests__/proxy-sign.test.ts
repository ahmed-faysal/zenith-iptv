import { describe, it, expect } from "vitest";
import { sign, verify } from "@/lib/proxy-sign";

const SECRET = "test-secret";

describe("proxy-sign", () => {
  it("verifies a signature it produced", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/a.m3u8", exp, sig, SECRET)).toBe(true);
  });
  it("rejects a tampered url", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/b.m3u8", exp, sig, SECRET)).toBe(false);
  });
  it("rejects a tampered exp", async () => {
    const sig = await sign("https://x/a.m3u8", 1_000_000, SECRET);
    expect(await verify("https://x/a.m3u8", 2_000_000, sig, SECRET)).toBe(false);
  });
  it("rejects a wrong secret", async () => {
    const exp = 1_000_000;
    const sig = await sign("https://x/a.m3u8", exp, SECRET);
    expect(await verify("https://x/a.m3u8", exp, sig, "other")).toBe(false);
  });
});
