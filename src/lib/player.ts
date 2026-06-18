import type { Level } from "@/components/QualitySelector";
import type { HlsConfig } from "hls.js";

// Tuning for the hls.js instance. Deliberate deviations from the defaults:
//   backBufferLength    — default Infinity keeps every played segment in RAM;
//                         on a TV left running for hours that's an unbounded
//                         leak. 30s back-buffer is ample for live playback.
//   capLevelToPlayerSize — let ABR pick the highest level that fits the actual
//                         rendered size, never larger (saves bandwidth/CPU when
//                         the surface is smaller than the source).
// A fresh object per call because hls.js stores and may mutate the config.
export function hlsConfig(): Partial<HlsConfig> {
  return { backBufferLength: 30, capLevelToPlayerSize: true };
}

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
