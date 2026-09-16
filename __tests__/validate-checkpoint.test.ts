import { describe, it, expect } from "vitest";
import {
  emptyCheckpoint, isAttempted, recordAttempt,
  pendingCandidates, playableChannels, checkpointSummary, validationFunnel,
} from "@/lib/validate/checkpoint";
import type { Channel } from "@/lib/types";

const ch = (id: string, urls = [`https://x/${id}-1.m3u8`, `https://x/${id}-2.m3u8`]): Channel => ({
  id, name: id, logo: "", streamUrls: urls,
  category: "News", languages: [], countries: [], quality: null,
});

const NOW = new Date("2026-09-16T00:00:00.000Z");

describe("checkpoint", () => {
  it("starts empty", () => {
    expect(checkpointSummary(emptyCheckpoint(NOW))).toEqual({ attempted: 0, playable: 0 });
  });

  it("remembers a channel that played", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: true, url: "https://x/a-2.m3u8" });
    expect(isAttempted(cp, "a")).toBe(true);
  });

  it("remembers a channel that failed, so a resume does not retry it", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: false, stage: "play" });
    expect(isAttempted(cp, "a")).toBe(true);
  });

  it("leaves untouched channels pending", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: false, stage: "play" });
    expect(pendingCandidates([ch("a"), ch("b")], cp).map((c) => c.id)).toEqual(["b"]);
  });

  it("caps pending work at the limit so a smoke run stays short", () => {
    const cp = emptyCheckpoint(NOW);
    const all = [ch("a"), ch("b"), ch("c"), ch("d")];
    expect(pendingCandidates(all, cp, 2).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("applies the limit to remaining work, not the original list", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: true, url: "https://x/a-1.m3u8" });
    recordAttempt(cp, "b", { ok: false, stage: "play" });
    const all = [ch("a"), ch("b"), ch("c"), ch("d")];
    expect(pendingCandidates(all, cp, 2).map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("rebuilds the curated list with the URL that actually played first", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: true, url: "https://x/a-2.m3u8" });
    recordAttempt(cp, "b", { ok: false, stage: "play" });
    const out = playableChannels(cp, [ch("a"), ch("b")]);
    expect(out).toHaveLength(1);
    expect(out[0].streamUrls).toEqual(["https://x/a-2.m3u8", "https://x/a-1.m3u8"]);
  });

  it("drops a checkpointed id that is no longer in the catalogue", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "gone", { ok: true, url: "https://x/gone-1.m3u8" });
    expect(playableChannels(cp, [ch("a")])).toEqual([]);
  });

  it("counts attempts and successes for the run summary", () => {
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: true, url: "https://x/a-1.m3u8" });
    recordAttempt(cp, "b", { ok: false, stage: "play" });
    recordAttempt(cp, "c", { ok: true, url: "https://x/c-1.m3u8" });
    expect(checkpointSummary(cp)).toEqual({ attempted: 3, playable: 2 });
  });

  it("keeps the funnel accurate across resumed runs", () => {
    // Without a stage on failures, a resumed run cannot say how many channels
    // cleared the HTTP probe but failed to actually play.
    const cp = emptyCheckpoint(NOW);
    recordAttempt(cp, "a", { ok: true, url: "https://x/a-1.m3u8" });
    recordAttempt(cp, "b", { ok: false, stage: "probe" });
    recordAttempt(cp, "c", { ok: false, stage: "play" });
    recordAttempt(cp, "d", { ok: false, stage: "probe" });
    expect(validationFunnel(cp, 10)).toEqual({
      candidates: 10, fastProbePassed: 2, playable: 1,
    });
  });
});
