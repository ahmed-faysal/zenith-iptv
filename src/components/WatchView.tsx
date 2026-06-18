"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import type { Level } from "./QualitySelector";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
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
  // The route's channel by default; a sidebar pick swaps it in place.
  const [override, setOverride] = useState<Channel | null>(null);
  const active = override ?? channels.find((c) => c.id === channelId) ?? null;
  // Show the current programme as the subtitle when EPG has it; else the category.
  // EPG keys on the base xmltv_id, so strip our id's @feed suffix to look it up.
  const nowPlaying = active ? epg[baseChannelId(active.id)]?.now : undefined;
  const subtitle = nowPlaying ? `Now · ${nowPlaying.title}` : active?.category;

  const [sidebar, setSidebar] = useState(false);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  // Idle-driven visibility; the overlay is always shown while paused or while the
  // sidebar is open, so we derive the effective value rather than force it via an
  // effect (keeps the auto-hide as the only thing toggling `chromeVisible`).
  const [chromeVisible, setChromeVisible] = useState(true);
  const showChrome = chromeVisible || paused || sidebar;
  // `fav` is derived from storage each render; bumping forces a re-read.
  const [, bumpFav] = useState(0);
  const fav = active ? isFavorite(active.id) : false;
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs mirror current state so the (mount-once) activity handlers read fresh
  // values without re-subscribing. Synced in an effect (not during render).
  const keepShownRef = useRef(false);
  const visibleRef = useRef(true);
  useEffect(() => {
    keepShownRef.current = paused || sidebar;
    visibleRef.current = showChrome;
  });

  useEffect(() => {
    function armHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (keepShownRef.current) return; // don't hide while paused / sidebar open
      hideTimer.current = setTimeout(() => setChromeVisible(false), 3500);
    }
    function onActivity() { setChromeVisible(true); armHide(); }
    // Capture phase: when hidden, the first key just reveals the overlay and is
    // swallowed so it doesn't also trigger a control underneath.
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

  // Cross-row D-pad nav (top bar ↕ center ↕ bottom) + initial focus, suspended
  // while the sidebar owns focus or the chrome is hidden.
  useGridFocus(containerRef, !!active, !sidebar && showChrome);

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
