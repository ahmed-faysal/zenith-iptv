"use client";
import { useEffect, useState } from "react";
import { formatClock } from "@/lib/player";

// Live wall-clock for the player top bar. Starts null so server and first client
// render match (no hydration mismatch), then ticks each minute.
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0); // async first paint — avoids set-state-in-effect
    const id = setInterval(tick, 1000 * 30);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  return <span suppressHydrationWarning>{now ? formatClock(now) : ""}</span>;
}
