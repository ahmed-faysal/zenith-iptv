import { describe, it, expect } from "vitest";
import { parseValidateArgs } from "@/lib/validate/args";

describe("parseValidateArgs", () => {
  it("defaults to a full, resumable run", () => {
    expect(parseValidateArgs([])).toEqual({ limit: undefined, fresh: false });
  });

  it("reads --limit as a separate argument", () => {
    expect(parseValidateArgs(["--limit", "50"]).limit).toBe(50);
  });

  it("reads --limit=N inline", () => {
    expect(parseValidateArgs(["--limit=50"]).limit).toBe(50);
  });

  it("treats --fresh as discarding the checkpoint", () => {
    expect(parseValidateArgs(["--fresh"]).fresh).toBe(true);
  });

  it("combines a smoke-test limit with a fresh start", () => {
    expect(parseValidateArgs(["--fresh", "--limit", "25"])).toEqual({ limit: 25, fresh: true });
  });

  it("rejects a non-numeric limit instead of silently running everything", () => {
    expect(() => parseValidateArgs(["--limit", "abc"])).toThrow(/--limit/);
  });

  it("rejects a zero or negative limit", () => {
    expect(() => parseValidateArgs(["--limit", "0"])).toThrow(/--limit/);
  });
});
