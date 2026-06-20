"use client";
import { useEffect, useRef, useState } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";
import { QualitySelector, type Level } from "./QualitySelector";
import { Clock } from "./Clock";
import { qualityLabel } from "@/lib/player";
import { isBackKey } from "@/lib/keys";

// The player chrome: a glassy overlay with a top metadata bar, a big center
// play/pause, and a bottom control row — modelled on a modern streaming player
// but honest for a live, no-DVR stream (no scrubber/seek). Each band is a
// `data-row` so WatchView's useGridFocus walks between them with the D-pad.
// `visible` drives a graceful fade + disables interaction when auto-hidden.

const circle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 48, height: 48, borderRadius: "50%", border: "none",
  background: "rgba(20,20,20,0.6)", color: "#fff", fontSize: 18, cursor: "pointer",
};

export function PlayerOverlay({
  channelName, channelSubtitle, isPaused, isFavorite, volume, muted,
  levels, currentLevel, visible = true,
  onTogglePlay, onToggleFavorite, onBack,
  onVolumeChange, onToggleMute, onFullscreen, onSelectLevel,
}: {
  channelName: string;
  channelSubtitle?: string;
  isPaused: boolean;
  isFavorite: boolean;
  volume: number;
  muted: boolean;
  levels: Level[];
  currentLevel: number;
  visible?: boolean;
  onTogglePlay: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onSelectLevel: (i: number) => void;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qualityBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  // The menu is only actually open while the overlay is visible (derived, so
  // hiding the overlay closes it without an effect).
  const menuOpen = qualityOpen && visible;
  useFocusNav(topRef, { orientation: "horizontal" });
  useFocusNav(bottomRef, { orientation: "horizontal" });

  // Focus the first option when the menu opens.
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();
  }, [menuOpen]);

  // Enter activates a button without the native click also firing.
  const press = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };
  const closeMenu = () => { setQualityOpen(false); qualityBtnRef.current?.focus(); };
  const pe = visible ? "auto" : "none";

  return (
    <div
      aria-hidden={!visible}
      style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}
    >
      <div style={scrim("top")} />
      <div style={scrim("bottom")} />

      {/* TOP BAR */}
      <div ref={topRef} data-row style={{ ...band, top: 0, alignItems: "flex-start", gap: 16, pointerEvents: pe }}>
        <button data-focusable aria-label="Back" onClick={onBack} onKeyDown={press(onBack)} style={circle}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={liveBadge}>● LIVE</span>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, textShadow: "0 1px 6px #000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channelName}</h1>
          </div>
          {channelSubtitle && (
            <p style={{ margin: "2px 0 0", color: "#9aa6b2", fontSize: 14, textShadow: "0 1px 4px #000" }}>{channelSubtitle}</p>
          )}
        </div>

        {levels.length > 1 && (
          <div style={{ position: "relative" }}>
            <button
              ref={qualityBtnRef}
              data-focusable
              aria-label={`Quality, currently ${qualityLabel(levels, currentLevel)}`}
              onClick={() => setQualityOpen((o) => !o)}
              onKeyDown={press(() => setQualityOpen((o) => !o))}
              style={{ ...pill, cursor: "pointer" }}
            >
              {qualityLabel(levels, currentLevel)} ▾
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                onKeyDown={(e) => {
                  if (isBackKey(e)) { e.stopPropagation(); closeMenu(); }
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") e.stopPropagation();
                }}
                style={{ position: "absolute", right: 0, top: "120%", padding: 8, borderRadius: 10,
                  background: "rgba(10,10,10,0.95)", maxWidth: 320 }}
              >
                <QualitySelector
                  levels={levels}
                  current={currentLevel}
                  onSelect={(i) => { onSelectLevel(i); closeMenu(); }}
                />
              </div>
            )}
          </div>
        )}
        <span style={{ ...pill, background: "transparent", color: "#cfd8e3" }}><Clock /></span>
      </div>

      {/* CENTER PLAY/PAUSE */}
      <div data-row style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <button
          data-focusable
          aria-label={isPaused ? "Play" : "Pause"}
          onClick={onTogglePlay}
          onKeyDown={press(onTogglePlay)}
          style={{ ...circle, width: 84, height: 84, fontSize: 30, background: "rgba(20,20,20,0.5)", pointerEvents: pe }}
        >
          {isPaused ? "▶" : "⏸"}
        </button>
      </div>

      {/* BOTTOM ROW */}
      <div ref={bottomRef} data-row style={{ ...band, bottom: 0, alignItems: "center", gap: 14, pointerEvents: pe }}>
        <button data-focusable aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={onToggleFavorite} onKeyDown={press(onToggleFavorite)}
          style={{ ...circle, color: isFavorite ? "#ffd24d" : "#fff" }}>{isFavorite ? "★" : "☆"}</button>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button data-focusable aria-label="Mute" onClick={onToggleMute} onKeyDown={press(onToggleMute)} style={circle}>
            {muted || volume === 0 ? "🔇" : "🔊"}
          </button>
          <input
            type="range" aria-label="Volume" min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: 110, accentColor: "#4da3ff" }}
          />
        </div>
        <button data-focusable aria-label="Fullscreen" onClick={onFullscreen} onKeyDown={press(onFullscreen)} style={circle}>⛶</button>
      </div>
    </div>
  );
}

const band: React.CSSProperties = {
  position: "absolute", left: 0, right: 0, display: "flex",
  padding: "24px 32px", color: "#fff",
};
const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px",
  borderRadius: 8, border: "none", background: "rgba(20,20,20,0.6)", color: "#cfd8e3", fontSize: 14,
};
const liveBadge: React.CSSProperties = {
  background: "#e23636", color: "#fff", fontSize: 13, fontWeight: 700,
  padding: "3px 8px", borderRadius: 6, letterSpacing: 0.4,
};
function scrim(side: "top" | "bottom"): React.CSSProperties {
  return {
    position: "absolute", left: 0, right: 0, height: 160, [side]: 0,
    background: `linear-gradient(to ${side === "top" ? "bottom" : "top"}, rgba(0,0,0,0.7), transparent)`,
  };
}
