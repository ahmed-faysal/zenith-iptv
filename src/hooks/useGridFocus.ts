"use client";
import { useEffect, RefObject } from "react";

// Reads the container as a grid: each [data-row] is a row, each [data-focusable]
// within it a column. Used on Home so a TV remote can move between rows and so a
// card is focused as soon as the app loads.
function grid(container: HTMLElement): HTMLElement[][] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-row]")).map(
    (row) => Array.from(row.querySelectorAll<HTMLElement>("[data-focusable]"))
  );
}

// `ready` gates the initial focus (content is on screen); `navEnabled` gates the
// arrow-key navigation separately, so a modal can suspend grid nav without the
// initial-focus effect re-firing and yanking focus back when the modal closes.
export function useGridFocus(
  ref: RefObject<HTMLElement | null>,
  ready: boolean,
  navEnabled: boolean = ready
) {
  // Initial focus: land on the first card as soon as content is present, so a
  // remote-only TV has somewhere to start.
  useEffect(() => {
    if (!ready || !ref.current) return;
    grid(ref.current)[0]?.[0]?.focus();
  }, [ref, ready]);

  // Vertical row-to-row navigation, preserving the column index.
  useEffect(() => {
    if (!navEnabled) return;
    const el = ref.current;
    if (!el) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = grid(el!);
      const active = document.activeElement as HTMLElement;

      let r = -1, c = -1;
      for (let i = 0; i < rows.length; i++) {
        const j = rows[i].indexOf(active);
        if (j !== -1) { r = i; c = j; break; }
      }
      if (r === -1) return;

      const targetRow = r + (e.key === "ArrowDown" ? 1 : -1);
      const row = rows[targetRow];
      if (!row || row.length === 0) return;

      e.preventDefault();
      row[Math.min(c, row.length - 1)].focus();
    }

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref, navEnabled]);
}
