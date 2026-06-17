"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { ControlBar } from "./ControlBar";
import { useChannels } from "@/hooks/useChannels";
import { useGridFocus } from "@/hooks/useGridFocus";
import { isBackKey, mediaAction } from "@/lib/keys";
import { setLastChannel, pushRecent, toggleFavorite, isFavorite } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const { channels: loaded } = useChannels();
  const channels = loaded ?? [];
  // The route's channel by default; a sidebar pick swaps it in place.
  const [override, setOverride] = useState<Channel | null>(null);
  const active = override ?? channels.find((c) => c.id === channelId) ?? null;
  const [sidebar, setSidebar] = useState(false);
  const [paused, setPaused] = useState(false);
  // `fav` is derived from storage each render; bumping forces a re-read after a
  // toggle (avoids syncing derived state through an effect).
  const [, bumpFav] = useState(0);
  const fav = active ? isFavorite(active.id) : false;
  const containerRef = useRef<HTMLDivElement>(null);

  // Cross-row D-pad nav (control bar ↕ quality strip) + initial focus on the
  // first control once the channel is ready. Disabled while the sidebar owns
  // focus.
  useGridFocus(containerRef, !!active, !sidebar);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
  }, [active]);

  function toggleFav() {
    if (!active) return;
    toggleFavorite(active.id);
    bumpFav((n) => n + 1);
  }

  // Back closes the sidebar first, then returns Home. The remote's transport
  // buttons (Play/Pause/Stop) drive playback. Works with the webOS Back button
  // (keyCode 461) and media keycodes as well as the standard names.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBackKey(e) || e.key === "Backspace") {
        if (sidebar) setSidebar(false);
        else router.push("/");
        return;
      }
      const m = mediaAction(e);
      if (m === "toggle") setPaused((p) => !p);
      else if (m === "play") setPaused(false);
      else if (m === "pause") setPaused(true);
      else if (m === "stop") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebar, router]);

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, background: "#000" }}>
      <ControlBar
        channelName={active.name}
        isFavorite={fav}
        isPaused={paused}
        onToggleFavorite={toggleFav}
        onTogglePlay={() => setPaused((p) => !p)}
        onOpenChannels={() => setSidebar(true)}
      />
      <VideoPlayer src={active.streamUrl} paused={paused} />
      <ChannelSidebar
        channels={channels}
        open={sidebar}
        onSelect={(c) => { setOverride(c); setSidebar(false); setPaused(false); }}
        onClose={() => setSidebar(false)}
      />
    </div>
  );
}
