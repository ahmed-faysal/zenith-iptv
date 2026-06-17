"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import type { Level } from "./QualitySelector";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { PlayerOverlay } from "./PlayerOverlay";
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
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  // `fav` is derived from storage each render; bumping forces a re-read.
  const [, bumpFav] = useState(0);
  const fav = active ? isFavorite(active.id) : false;
  const containerRef = useRef<HTMLDivElement>(null);

  // Cross-row D-pad nav (top bar ↕ center ↕ bottom ↕ quality) + initial focus,
  // suspended while the sidebar owns focus.
  useGridFocus(containerRef, !!active, !sidebar);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
  }, [active]);

  // Back closes the sidebar first, then returns Home; remote transport keys
  // drive playback (webOS keyCode 461 + media keycodes handled in lib/keys).
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

  function toggleFav() {
    if (!active) return;
    toggleFavorite(active.id);
    bumpFav((n) => n + 1);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }

  function pick(c: Channel) {
    setOverride(c);
    setSidebar(false);
    setPaused(false);
    setCurrentLevel(-1); // reset quality for the new stream
  }

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, background: "#000" }}>
      <VideoPlayer
        src={active.streamUrl}
        paused={paused}
        volume={volume}
        muted={muted}
        currentLevel={currentLevel}
        onLevels={setLevels}
      />
      <PlayerOverlay
        channelName={active.name}
        channelSubtitle={active.category}
        isPaused={paused}
        isFavorite={fav}
        volume={volume}
        muted={muted}
        levels={levels}
        currentLevel={currentLevel}
        onTogglePlay={() => setPaused((p) => !p)}
        onToggleFavorite={toggleFav}
        onOpenChannels={() => setSidebar(true)}
        onBack={() => router.push("/")}
        onVolumeChange={(v) => { setVolume(v); if (v > 0) setMuted(false); }}
        onToggleMute={() => setMuted((m) => !m)}
        onFullscreen={toggleFullscreen}
        onSelectLevel={setCurrentLevel}
      />
      <ChannelSidebar
        channels={channels}
        open={sidebar}
        onSelect={pick}
        onClose={() => setSidebar(false)}
      />
    </div>
  );
}
