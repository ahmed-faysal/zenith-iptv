import type { Channel } from "../types";

export type ValidationSummary = {
  candidates: number;
  fastProbePassed: number;
  playable: number;
};

export type CuratedFile = {
  generatedAt: string;
  summary: ValidationSummary;
  channels: Channel[];
};

// Put the URL that actually played first; keep the others as ordered fallbacks.
export function reorderWorkingFirst(channel: Channel, workingUrl: string): Channel {
  const rest = channel.streamUrls.filter((u) => u !== workingUrl);
  return { ...channel, streamUrls: [workingUrl, ...rest] };
}

// Assemble the on-disk curated catalogue.
export function buildCuratedFile(
  channels: Channel[],
  summary: ValidationSummary,
  now: Date,
): CuratedFile {
  return { generatedAt: now.toISOString(), summary, channels };
}
