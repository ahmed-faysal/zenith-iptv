"use client";
import { useEffect, RefObject } from "react";

type Options = { orientation?: "horizontal" | "vertical" };

export function useFocusNav(
  ref: RefObject<HTMLElement | null>,
  { orientation = "horizontal" }: Options = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function items(): HTMLElement[] {
      return Array.from(el!.querySelectorAll<HTMLElement>("[data-focusable]"));
    }

    function onKey(e: KeyboardEvent) {
      const list = items();
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;

      const next = (delta: number) => {
        const t = list[idx + delta];
        if (t) { e.preventDefault(); t.focus(); }
      };

      const horiz = orientation !== "vertical";
      const vert = orientation !== "horizontal";
      if (horiz && e.key === "ArrowRight") next(1);
      if (horiz && e.key === "ArrowLeft") next(-1);
      if (vert && e.key === "ArrowDown") next(1);
      if (vert && e.key === "ArrowUp") next(-1);
    }

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref, orientation]);
}
