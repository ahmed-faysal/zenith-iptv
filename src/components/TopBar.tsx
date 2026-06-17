"use client";
import { useRef } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";

const btn: React.CSSProperties = {
  background: "#161616", color: "#eee", border: "2px solid transparent",
  borderRadius: 10, padding: "10px 16px", fontSize: 16, cursor: "pointer",
};

// Focusable top bar so a TV remote can reach Search and Settings (it's a
// data-row, so useGridFocus treats it as the first navigable row; left/right
// move between the buttons).
export function TopBar({
  onSearch, onSettings,
}: { onSearch: () => void; onSettings: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  return (
    <div ref={ref} data-row style={{ display: "flex", gap: 12, padding: "0 16px", marginBottom: 24 }}>
      <button
        data-focusable
        onClick={onSearch}
        style={btn}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#4da3ff")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
      >
        🔍 Search
      </button>
      <button
        data-focusable
        onClick={onSettings}
        style={btn}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#4da3ff")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
      >
        ⚙ Settings
      </button>
    </div>
  );
}
