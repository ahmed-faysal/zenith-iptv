"use client";
import { useRef } from "react";
import { useFocusNav } from "@/hooks/useFocusNav";

// The app bar: brand on the left, scrollable category tabs in the middle, and
// Search/Settings on the right. It's a single data-row so useGridFocus treats it
// as the first navigable row and left/right walks tabs → actions. Category props
// are optional so the bar still renders (just brand + actions) without them.
export function TopBar({
  onSearch, onSettings, categories = [], activeCategory = "All", onCategory,
}: {
  onSearch: () => void;
  onSettings: () => void;
  categories?: string[];
  activeCategory?: string;
  onCategory?: (cat: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  // Enter activates without the native click also firing (double-trigger guard).
  const press = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); fn(); }
  };

  return (
    <div ref={ref} data-row className="app-bar">
      <div className="app-bar__brand">
        <span className="app-bar__mark" aria-hidden>📺</span>
        <span className="app-bar__name">Live TV</span>
      </div>

      {categories.length > 0 && (
        <div className="app-bar__tabs">
          {categories.map((c) => (
            <button
              key={c}
              data-focusable
              className={`tab${c === activeCategory ? " is-active" : ""}`}
              aria-pressed={c === activeCategory}
              onClick={() => onCategory?.(c)}
              onKeyDown={press(() => onCategory?.(c))}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="app-bar__actions">
        <button data-focusable aria-label="Search" className="icon-btn"
          onClick={onSearch} onKeyDown={press(onSearch)}>🔍</button>
        <button data-focusable aria-label="Settings" className="icon-btn"
          onClick={onSettings} onKeyDown={press(onSettings)}>⚙</button>
      </div>
    </div>
  );
}
