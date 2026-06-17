"use client";
import { useRef } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";

// The Player's D-pad-navigable control strip. It's a `data-row` so useGridFocus
// in WatchView can reach it (and move down to the quality strip); left/right move
// between the buttons. Favorite/Channels activate on OK/Enter — no physical "F"
// key, which a TV remote doesn't have.
const btn: React.CSSProperties = {
  background: "rgba(0,0,0,0.55)", color: "#fff", border: "2px solid transparent",
  borderRadius: 10, padding: "10px 16px", fontSize: 18, cursor: "pointer",
};

export function ControlBar({
  channelName, isFavorite, onToggleFavorite, onOpenChannels,
}: {
  channelName: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenChannels: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  return (
    <div
      ref={ref}
      data-row
      style={{
        position: "absolute", top: 16, left: 16, zIndex: 2,
        display: "flex", alignItems: "center", gap: 12, color: "#fff",
      }}
    >
      <button
        data-focusable
        onClick={onToggleFavorite}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onToggleFavorite(); } }}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        style={{ ...btn, color: isFavorite ? "#ffd24d" : "#fff" }}
      >
        {isFavorite ? "★" : "☆"}
      </button>
      <button
        data-focusable
        onClick={onOpenChannels}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onOpenChannels(); } }}
        style={btn}
      >
        ☰ Channels
      </button>
      <strong style={{ marginLeft: 4, fontSize: 18, textShadow: "0 1px 4px #000" }}>
        {channelName}
      </strong>
    </div>
  );
}
