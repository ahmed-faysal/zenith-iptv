import type { Channel } from "./types";

// The curated file (src/data/curated.json) is the intended catalogue, but it
// ships as an empty placeholder until `npm run validate` is run and committed.
// Serving that empty list blanks the whole app, so an empty curated list falls
// back to the live source merge: a flaky catalogue beats no catalogue. If that
// fails too (every source down), return empty and let the UI show its error
// state rather than throwing a 500.
export async function resolveCatalogue(
  curated: Channel[],
  fetchLive: () => Promise<Channel[]>,
): Promise<Channel[]> {
  if (curated.length > 0) return curated;
  try {
    return await fetchLive();
  } catch (err) {
    console.warn("[catalogue] curated empty and live merge failed:", err);
    return [];
  }
}
