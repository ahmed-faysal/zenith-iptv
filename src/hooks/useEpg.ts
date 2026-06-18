"use client";
import { useEffect, useState } from "react";
import type { NowNext } from "@/lib/epg";

export type EpgMap = Record<string, NowNext>;

// Fetches the now/next map from /api/epg and refreshes periodically so the
// current programme stays accurate across a long watch session. Failures are
// swallowed — EPG is enrichment, never required (empty map => no overlay).
export function useEpg(refreshMs = 5 * 60 * 1000): EpgMap {
  const [epg, setEpg] = useState<EpgMap>({});

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/epg")
        .then((r) => r.json())
        .then((d) => { if (alive) setEpg(d.epg ?? {}); })
        .catch(() => {});
    load();
    const id = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [refreshMs]);

  return epg;
}
