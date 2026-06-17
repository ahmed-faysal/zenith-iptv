"use client";
import { useRef } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";
import { QualitySelector, type Level } from "./QualitySelector";
import { Clock } from "./Clock";
import { qualityLabel } from "@/lib/player";

// The full player chrome: a glassy overlay with a top metadata bar, a big center
// play/pause, and a bottom control row — modelled on a modern streaming player
// but stripped of controls that don't apply to a live, no-DVR stream (no
// scrubber/seek). Each band is a `data-row` so WatchView's useGridFocus walks
// between them with the D-pad; left/right move within a band.

const circle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 48, height: 48, borderRadius: "50%", border: "none",
  background: "rgba(20,20,20,0.6)", color: "#fff", fontSize: 18, cursor: "pointer",
};
const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
  borderRadius: 8, background: "rgba(20,20,20,0.6)", color: "#cfd8e3", fontSize: 14,
};

export function PlayerOverlay({
  channelName, channelSubtitle, isPaused, isFavorite, volume, muted,
  levels, currentLevel,
  onTogglePlay, onToggleFavorite, onOpenChannels, onBack,
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
  onTogglePlay: () => void;
  onToggleFavorite: () => void;
  onOpenChannels: () => void;
  onBack: () => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onSelectLevel: (i: number) => void;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useFocusNav(topRef, { orientation: "horizontal" });
  useFocusNav(bottomRef, { orientation: "horizontal" });

  // Enter activates a button without the native click also firing (no double-toggle).
  const press = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
      {/* gradient scrims top & bottom for legibility over any frame */}
      <div style={scrim("top")} />
      <div style={scrim("bottom")} />

      {/* TOP BAR */}
      <div ref={topRef} data-row style={{ ...band, top: 0, alignItems: "flex-start", gap: 16 }}>
        <button data-focusable aria-label="Back" onClick={onBack} onKeyDown={press(onBack)} style={circle}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={liveBadge}>● LIVE</span>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, textShadow: "0 1px 6px #000" }}>{channelName}</h1>
          </div>
          {channelSubtitle && (
            <p style={{ margin: "2px 0 0", color: "#9aa6b2", fontSize: 15, textShadow: "0 1px 4px #000" }}>{channelSubtitle}</p>
          )}
        </div>
        <span style={pill}>{(() => {
          const ql = qualityLabel(levels, currentLevel);
          return ql === "Auto" ? "Auto" : `HD · ${ql}`;
        })()}</span>
        <span style={{ ...pill, background: "transparent" }}><Clock /></span>
      </div>

      {/* CENTER PLAY/PAUSE */}
      <div data-row style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <button
          data-focusable
          aria-label={isPaused ? "Play" : "Pause"}
          onClick={onTogglePlay}
          onKeyDown={press(onTogglePlay)}
          style={{
            ...circle, width: 84, height: 84, fontSize: 30,
            background: "rgba(20,20,20,0.5)", pointerEvents: "auto",
          }}
        >
          {isPaused ? "▶" : "⏸"}
        </button>
      </div>

      {/* BOTTOM ROW */}
      <div ref={bottomRef} data-row style={{ ...band, bottom: 0, alignItems: "center", gap: 14 }}>
        <span style={{ ...liveBadge, background: "transparent", color: "#4da3ff", marginRight: 4 }}>● LIVE</span>
        <button data-focusable aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={onToggleFavorite} onKeyDown={press(onToggleFavorite)}
          style={{ ...circle, color: isFavorite ? "#ffd24d" : "#fff" }}>{isFavorite ? "★" : "☆"}</button>
        <button data-focusable aria-label="Channels" onClick={onOpenChannels} onKeyDown={press(onOpenChannels)}
          style={{ ...circle, width: "auto", borderRadius: 24, padding: "0 16px", gap: 8 }}>☰ Channels</button>

        <div style={{ flex: 1 }} />

        {/* Volume: mute button is D-pad focusable; the slider is for pointer users. */}
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

      {/* QUALITY ROW — only when the stream offers multiple renditions */}
      {levels.length > 1 && (
        <div style={{ position: "absolute", right: 24, bottom: 92, pointerEvents: "auto" }}>
          <QualitySelector levels={levels} current={currentLevel} onSelect={onSelectLevel} />
        </div>
      )}
    </div>
  );
}

const band: React.CSSProperties = {
  position: "absolute", left: 0, right: 0, display: "flex",
  padding: "24px 32px", color: "#fff", pointerEvents: "auto",
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
