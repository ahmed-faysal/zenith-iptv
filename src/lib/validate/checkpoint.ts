import type { Channel } from "../types";
import { reorderWorkingFirst } from "./curated";
import type { ValidationSummary } from "./curated";

// Failures carry the stage they died at, so a resumed run can still report the
// full funnel (candidates -> probe survivors -> actually playable) rather than
// only knowing "not playable".
export type FailStage = "probe" | "play";
export type AttemptResult = { ok: true; url: string } | { ok: false; stage: FailStage };

// Per-channel outcomes accumulated across runs. A full validation pass takes
// ~100 minutes, so it is written to disk periodically and reloaded on the next
// run: an interrupted pass resumes instead of starting over. Failures are
// recorded too — otherwise a resume would re-test the ~73% that never play.
export type Checkpoint = {
  startedAt: string;
  results: Record<string, AttemptResult>;
};

export function emptyCheckpoint(now: Date): Checkpoint {
  return { startedAt: now.toISOString(), results: {} };
}

export function isAttempted(cp: Checkpoint, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(cp.results, id);
}

export function recordAttempt(cp: Checkpoint, id: string, result: AttemptResult): void {
  cp.results[id] = result;
}

// Channels this run still has to test, in catalogue order. `limit` caps the
// *remaining* work, so repeated `--limit 200` runs chew through the backlog
// rather than re-doing the same first 200 each time.
export function pendingCandidates(
  candidates: Channel[],
  cp: Checkpoint,
  limit?: number,
): Channel[] {
  const pending = candidates.filter((c) => !isAttempted(cp, c.id));
  return limit === undefined ? pending : pending.slice(0, limit);
}

// Rebuild the shippable catalogue from the checkpoint. Ids that are no longer
// in the source catalogue are dropped, so a stale checkpoint can't resurrect a
// channel that has since disappeared upstream.
export function playableChannels(cp: Checkpoint, candidates: Channel[]): Channel[] {
  const out: Channel[] = [];
  for (const channel of candidates) {
    const result = cp.results[channel.id];
    if (result?.ok) out.push(reorderWorkingFirst(channel, result.url));
  }
  return out;
}

export function checkpointSummary(cp: Checkpoint): { attempted: number; playable: number } {
  const all = Object.values(cp.results);
  return { attempted: all.length, playable: all.filter((r) => r.ok).length };
}

// The funnel for curated.json's summary, derived from the whole checkpoint so
// it stays correct no matter how many partial runs produced it.
export function validationFunnel(cp: Checkpoint, candidates: number): ValidationSummary {
  const all = Object.values(cp.results);
  const playable = all.filter((r) => r.ok).length;
  const probeFailed = all.filter((r) => !r.ok && r.stage === "probe").length;
  return { candidates, fastProbePassed: all.length - probeFailed, playable };
}
