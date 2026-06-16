"use client";
import { useRef } from "react";
import type { Channel } from "@/lib/types";
import { useFocusNav } from "@/hooks/useFocusNav";

export function ChannelSidebar({
  channels, open, onSelect,
}: { channels: Channel[]; open: boolean; onSelect: (c: Channel) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "vertical" });
  return (
    <aside
      ref={ref}
      style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: 320,
        background: "rgba(0,0,0,0.85)", transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.2s", overflowY: "auto", padding: 12,
      }}
    >
      {channels.map((c) => (
        <button
          key={c.id}
          data-focusable
          onClick={() => onSelect(c)}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(c); }}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: 12,
            background: "transparent", color: "#eee", border: "none", cursor: "pointer",
          }}
          onFocus={(e) => (e.currentTarget.style.background = "#222")}
          onBlur={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {c.name}
        </button>
      ))}
    </aside>
  );
}
