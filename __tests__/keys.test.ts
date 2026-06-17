import { describe, it, expect } from "vitest";
import { isBackKey, mediaAction, BACK_KEYCODE } from "@/lib/keys";

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

describe("mediaAction", () => {
  it("maps the Play/Pause toggle key", () => {
    expect(mediaAction(ev({ key: "MediaPlayPause" }))).toBe("toggle");
    expect(mediaAction(ev({ keyCode: 10252 }))).toBe("toggle"); // common TV code
    expect(mediaAction(ev({ keyCode: 179 }))).toBe("toggle");
  });
  it("maps a dedicated Play key", () => {
    expect(mediaAction(ev({ key: "MediaPlay" }))).toBe("play");
    expect(mediaAction(ev({ keyCode: 415 }))).toBe("play");
  });
  it("maps a dedicated Pause key", () => {
    expect(mediaAction(ev({ key: "MediaPause" }))).toBe("pause");
    expect(mediaAction(ev({ keyCode: 19 }))).toBe("pause");
  });
  it("maps the Stop key", () => {
    expect(mediaAction(ev({ key: "MediaStop" }))).toBe("stop");
    expect(mediaAction(ev({ keyCode: 413 }))).toBe("stop");
  });
  it("returns null for non-media keys", () => {
    expect(mediaAction(ev({ key: "Enter", keyCode: 13 }))).toBeNull();
    expect(mediaAction(ev({ key: "ArrowDown", keyCode: 40 }))).toBeNull();
  });
});
