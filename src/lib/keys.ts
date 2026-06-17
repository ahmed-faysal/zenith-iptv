// webOS fires the Magic Remote Back button as keyCode 461 (0x1CD), not "Escape",
// and sometimes reports key as "GoBack" or "Unidentified" — so we match on both
// the key name and the numeric code. Other TVs / desktop send "Escape".
export const BACK_KEYCODE = 461;

type AnyKeyEvent = Pick<KeyboardEvent, "key" | "keyCode">;

export function isBackKey(e: AnyKeyEvent): boolean {
  return e.key === "Escape" || e.key === "GoBack" || e.keyCode === BACK_KEYCODE;
}

// A TV remote's transport buttons fire dedicated media keys. webOS/Tizen report
// them by `key` name and/or numeric keyCode; we accept both. Seek/FF/RW are
// intentionally omitted — they aren't meaningful for live streams (see catchup,
// backlog #15).
export type MediaAction = "toggle" | "play" | "pause" | "stop";

export function mediaAction(e: AnyKeyEvent): MediaAction | null {
  if (e.key === "MediaPlayPause" || e.keyCode === 10252 || e.keyCode === 179) return "toggle";
  if (e.key === "MediaPlay" || e.keyCode === 415) return "play";
  if (e.key === "MediaPause" || e.keyCode === 19) return "pause";
  if (e.key === "MediaStop" || e.keyCode === 413) return "stop";
  return null;
}
