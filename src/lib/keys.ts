// webOS fires the Magic Remote Back button as keyCode 461 (0x1CD), not "Escape",
// and sometimes reports key as "GoBack" or "Unidentified" — so we match on both
// the key name and the numeric code. Other TVs / desktop send "Escape".
export const BACK_KEYCODE = 461;

type AnyKeyEvent = Pick<KeyboardEvent, "key" | "keyCode">;

export function isBackKey(e: AnyKeyEvent): boolean {
  return e.key === "Escape" || e.key === "GoBack" || e.keyCode === BACK_KEYCODE;
}
