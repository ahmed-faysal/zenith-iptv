"use client";
import { useEffect, useState } from "react";
import type { NowNext } from "@/lib/epg";

export type EpgMap = Record<string, NowNext>;

// Fetches the now/next map from /api/epg and refreshes periodically so the
// current programme stays accurate across a long watch session. Failures are
// swallowed — EPG is enrichment, never required (empty map => no overlay).
// Polling pauses while the document is hidden (TV screen off / app backgrounded)
// and resumes with an immediate fetch when the app becomes visible again.
export function useEpg(refreshMs = 5 * 60 * 1000): EpgMap {
  const [epg, setEpg] = useState<EpgMap>({});

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      if (document.hidden) return;
      fetch(`${base}/api/epg`)
        .then((r) => r.json())
        .then((d) => { if (alive) setEpg(d.epg ?? {}); })
        .catch(() => {});
    };

    const startPolling = () => {
      load();
      intervalId = setInterval(load, refreshMs);
    };

    const stopPolling = () => {
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    };

    const onVisibility = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };

    document.addEventListener("visibilitychange", onVisibility);
    startPolling();

    return () => {
      alive = false;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshMs]);

  return epg;
}
