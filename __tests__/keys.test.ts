import { describe, it, expect } from "vitest";
import { isBackKey, BACK_KEYCODE } from "@/lib/keys";

// A TV remote's Back button differs by platform: webOS sends keyCode 461 (and
// often key "GoBack" or "Unidentified"), while desktop/other TVs send Escape.
const ev = (init: Partial<KeyboardEvent>): KeyboardEvent =>
  ({ key: "", keyCode: 0, ...init }) as KeyboardEvent;

describe("isBackKey", () => {
  it("matches the webOS Back keyCode (461)", () => {
    expect(isBackKey(ev({ key: "Unidentified", keyCode: BACK_KEYCODE }))).toBe(true);
  });
  it("matches Escape", () => {
    expect(isBackKey(ev({ key: "Escape" }))).toBe(true);
  });
  it("matches the webOS GoBack key name", () => {
    expect(isBackKey(ev({ key: "GoBack" }))).toBe(true);
  });
  it("does not match arrow or character keys", () => {
    expect(isBackKey(ev({ key: "ArrowLeft", keyCode: 37 }))).toBe(false);
    expect(isBackKey(ev({ key: "f", keyCode: 70 }))).toBe(false);
    expect(isBackKey(ev({ key: "Enter", keyCode: 13 }))).toBe(false);
  });
  it("does not treat Backspace as Back (callers handle it contextually)", () => {
    expect(isBackKey(ev({ key: "Backspace", keyCode: 8 }))).toBe(false);
  });
});
