"use client";
import { useEffect, useState } from "react";
import type { Channel } from "@/lib/types";
import { loadChannels } from "@/lib/channels-client";

// Thin React glue over the shared loadChannels cache (see channels-client.ts).
export function useChannels() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadChannels()
      .then((c) => { if (alive) setChannels(c); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  return { channels, error };
}
