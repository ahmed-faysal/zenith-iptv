"use client";
import { useEffect, RefObject } from "react";

// 2-axis D-pad navigation for a wrapping CSS grid (the category page). Left/Right
// step one card; Up/Down move a whole visual row by deriving the column count
// from layout (items sharing the top row's offsetTop). When a move would leave
// the grid (left of the first card, past the last row, etc.) the event is left
// to bubble so the page-level useGridFocus can hand focus to the row above/below
// (the grid itself is a `data-row`, and "Show more" is its own `data-row`).
export function useGridNav(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onKey(e: KeyboardEvent) {
      const items = Array.from(el!.querySelectorAll<HTMLElement>("[data-focusable]"));
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i === -1) return;

      // Items on the same visual row share an offsetTop; the first row's count is
      // the column count. (offsetTop is unaffected by focus scale transforms.)
      const top0 = items[0].offsetTop;
      const cols = items.filter((it) => it.offsetTop === top0).length || 1;

      let target = -1;
      switch (e.key) {
        case "ArrowRight": target = i + 1; break;
        case "ArrowLeft":  target = i - 1; break;
        case "ArrowDown":  target = i + cols; break;
        case "ArrowUp":    target = i - cols; break;
        default: return;
      }

      // In-range move: handle it and stop it reaching useGridFocus. Out of range:
      // let it bubble so useGridFocus exits the grid to an adjacent row.
      if (target >= 0 && target < items.length) {
        e.preventDefault();
        e.stopPropagation();
        items[target].focus();
      }
    }

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref]);
}
