import type { Level } from "@/components/QualitySelector";

// "12:43 AM" — explicit 12-hour formatting (deterministic, unlike
// toLocaleTimeString which varies by host locale).
export function formatClock(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Label for the quality pill: "Auto" unless an explicit, in-range level is set.
export function qualityLabel(levels: Level[], current: number): string {
  const level = current >= 0 ? levels[current] : undefined;
  return level ? `${level.height}p` : "Auto";
}
