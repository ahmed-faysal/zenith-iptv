"use client";
import { useEffect, useRef } from "react";
import type { Channel } from "@/lib/types";
import { useFocusNav } from "@/hooks/useFocusNav";
import { isBackKey } from "@/lib/keys";

export function ChannelSidebar({
  channels, open, onSelect, onClose,
}: {
  channels: Channel[];
  open: boolean;
  onSelect: (c: Channel) => void;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useFocusNav(ref, { orientation: "vertical" });

  // On open: remember who had focus and land on the first channel. On close:
  // hand focus back to the opener (e.g. the Player's Channels button) so the
  // remote isn't stranded.
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement;
      ref.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();
    } else {
      opener.current?.focus();
      opener.current = null;
    }
  }, [open]);

  return (
    <aside
      ref={ref}
      onKeyDown={(e) => { if (onClose && isBackKey(e)) { e.stopPropagation(); onClose(); } }}
      style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: 320,
        background: "rgba(0,0,0,0.85)", transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.2s", overflowY: "auto", padding: 12, zIndex: 3,
      }}
    >
      {channels.map((c) => (
        <button
          key={c.id}
          data-focusable
          onClick={() => onSelect(c)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelect(c); } }}
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
