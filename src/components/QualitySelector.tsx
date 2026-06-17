"use client";
import { useRef } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";

export type Level = { height: number };

// A D-pad-navigable quality strip: a `data-row` (so WatchView's useGridFocus can
// move down into it) whose buttons are `data-focusable` and select on OK/Enter.
export function QualitySelector({
  levels, current, onSelect,
}: { levels: Level[]; current: number; onSelect: (levelIndex: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  if (levels.length <= 1) return null;

  const btn = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 16,
    background: active ? "#4da3ff" : "rgba(0,0,0,0.55)", color: "#fff",
    border: "2px solid transparent",
  });

  const choose = (i: number) => () => onSelect(i);

  return (
    <div ref={ref} data-row style={{ display: "flex", gap: 8 }}>
      <button data-focusable style={btn(current === -1)} onClick={choose(-1)}>Auto</button>
      {levels.map((l, i) => (
        <button key={i} data-focusable style={btn(current === i)} onClick={choose(i)}>
          {l.height}p
        </button>
      ))}
    </div>
  );
}
