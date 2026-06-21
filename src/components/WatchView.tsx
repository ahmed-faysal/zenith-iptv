"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Level } from "./QualitySelector";
import { VideoPlayer } from "./VideoPlayer";
import { PlayerOverlay } from "./PlayerOverlay";
import { useChannels } from "@/hooks/useChannels";
import { useEpg } from "@/hooks/useEpg";
import { useGridFocus } from "@/hooks/useGridFocus";
import { isBackKey, mediaAction } from "@/lib/keys";
import { baseChannelId } from "@/lib/epg";
import { setLastChannel, pushRecent, toggleFavorite, isFavorite } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const { channels: loaded } = useChannels();
  const channels = loaded ?? [];
  const epg = useEpg();
  const active = channels.find((c) => c.id === channelId) ?? null;
  const nowPlaying = active ? epg[baseChannelId(active.id)]?.now : undefined;
  const subtitle = nowPlaying ? `Now · ${nowPlaying.title}` : active?.category;

  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [chromeVisible, setChromeVisible] = useState(true);
  const showChrome = chromeVisible || paused;
  const [, bumpFav] = useState(0);
  const fav = active ? isFavorite(active.id) : false;
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepShownRef = useRef(false);
  const visibleRef = useRef(true);
  useEffect(() => {
    keepShownRef.current = paused;
    visibleRef.current = showChrome;
  });

  useEffect(() => {
    function armHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (keepShownRef.current) return;
      hideTimer.current = setTimeout(() => setChromeVisible(false), 3500);
    }
    function onActivity() { setChromeVisible(true); armHide(); }
    function onKeyCapture(e: KeyboardEvent) {
      if (!visibleRef.current) { e.stopPropagation(); e.preventDefault(); setChromeVisible(true); }
      armHide();
    }
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onKeyCapture, true);
    armHide();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onKeyCapture, true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useGridFocus(containerRef, !!active, showChrome);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
  }, [active]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isBackKey(e) || e.key === "Backspace") { router.back(); return; }
      const m = mediaAction(e);
      if (m === "toggle") setPaused((p) => !p);
      else if (m === "play") setPaused(false);
      else if (m === "pause") setPaused(true);
      else if (m === "stop") router.back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

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

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, background: "#000" }}>
      <VideoPlayer
        key={active.id}
        srcs={active.streamUrls}
        paused={paused}
        volume={volume}
        muted={muted}
        currentLevel={currentLevel}
        onLevels={setLevels}
      />
      <PlayerOverlay
        channelName={active.name}
        channelSubtitle={subtitle}
        isPaused={paused}
        isFavorite={fav}
        volume={volume}
        muted={muted}
        levels={levels}
        currentLevel={currentLevel}
        visible={showChrome}
        onTogglePlay={() => setPaused((p) => !p)}
        onToggleFavorite={toggleFav}
        onBack={() => router.back()}
        onVolumeChange={(v) => { setVolume(v); if (v > 0) setMuted(false); }}
        onToggleMute={() => setMuted((m) => !m)}
        onFullscreen={toggleFullscreen}
        onSelectLevel={setCurrentLevel}
      />
    </div>
  );
}
