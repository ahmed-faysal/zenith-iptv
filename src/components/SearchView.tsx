"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { useChannels } from "@/hooks/useChannels";
import { isBackKey } from "@/lib/keys";
import { setLastChannel, pushRecent } from "@/lib/storage";

export function SearchView() {
  const router = useRouter();
  const { channels } = useChannels();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !channels) return [];
    return channels.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 60);
  }, [q, channels]);

  // Remote Back/Escape returns Home — but Backspace must still edit the query
  // while the user is typing in the box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const editing = document.activeElement === inputRef.current && q !== "";
      if (isBackKey(e) || (e.key === "Backspace" && !editing)) {
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, q]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <main style={{ padding: 16 }}>
      <input
        ref={inputRef}
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            resultsRef.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();
          }
        }}
        placeholder="Search channels…"
        style={{ width: "100%", maxWidth: 480, padding: 12, fontSize: 18, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#eee" }}
      />
      <div
        ref={resultsRef}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); inputRef.current?.focus(); }
        }}
        style={{ marginTop: 24 }}
      >
        <CategoryRow title={`Results (${results.length})`} channels={results} onSelect={open} />
      </div>
    </main>
  );
}
