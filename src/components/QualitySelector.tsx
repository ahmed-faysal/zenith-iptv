"use client";

export type Level = { height: number };

export function QualitySelector({
  levels, current, onSelect,
}: { levels: Level[]; current: number; onSelect: (levelIndex: number) => void }) {
  if (levels.length <= 1) return null;
  const btn = (active: boolean) => ({
    padding: "4px 10px", borderRadius: 8, cursor: "pointer",
    background: active ? "#4da3ff" : "#222", color: "#fff", border: "none",
  });
  return (
    <div data-focusable style={{ display: "flex", gap: 8 }}>
      <button style={btn(current === -1)} onClick={() => onSelect(-1)}>Auto</button>
      {levels.map((l, i) => (
        <button key={i} style={btn(current === i)} onClick={() => onSelect(i)}>
          {l.height}p
        </button>
      ))}
    </div>
  );
}
