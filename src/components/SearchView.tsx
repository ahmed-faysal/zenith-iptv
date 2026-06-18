"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { useChannels } from "@/hooks/useChannels";
import { isBackKey } from "@/lib/keys";
import { searchChannels } from "@/lib/search";
import { getRecents, setLastChannel, pushRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];
const BROWSE_LIMIT = 20; // per-category teaser size in the pre-typing state

export function SearchView() {
  const router = useRouter();
  const { channels } = useChannels();
  const list = useMemo(() => channels ?? [], [channels]);
  const [q, setQ] = useState("");
  const backRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const typing = q.trim().length > 0;
  const results = useMemo(() => searchChannels(list, q), [list, q]);

  const byId = new Map(list.map((c) => [c.id, c]));
  const recents = getRecents().map((id) => byId.get(id)).filter(Boolean) as Channel[];

  // Remote Back/Escape returns Home — but Backspace must still edit the query
  // while the user is typing in the box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const editing = document.activeElement === inputRef.current && q !== "";
      if (isBackKey(e) || (e.key === "Backspace" && !editing)) router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, q]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  const focusFirstResult = () =>
    resultsRef.current?.querySelector<HTMLElement>("[data-focusable]")?.focus();

  return (
    <main className="search-main">
      {/* Glassy header: an on-screen Back (for pointer/Magic-Remote users) beside
          the search field, styled like the player chrome. */}
      <div className="search-bar">
        <button
          ref={backRef}
          data-focusable
          aria-label="Back"
          className="icon-btn"
          onClick={() => router.push("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); router.push("/"); }
            if (e.key === "ArrowDown") { e.preventDefault(); inputRef.current?.focus(); }
          }}
        >
          ‹
        </button>
        <div className="search-field">
          <span className="search-field__icon" aria-hidden>🔍</span>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); focusFirstResult(); }
              if (e.key === "ArrowUp") { e.preventDefault(); backRef.current?.focus(); }
            }}
            placeholder="Search channels…"
            className="search-input"
          />
        </div>
      </div>

      <div
        ref={resultsRef}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); inputRef.current?.focus(); }
        }}
      >
        {typing ? (
          results.length > 0 ? (
            <CategoryRow title={`Results (${results.length})`} channels={results} onSelect={open} />
          ) : (
            <p className="search-empty">No channels match “{q.trim()}”.</p>
          )
        ) : (
          <>
            <CategoryRow title="Continue Watching" channels={recents} onSelect={open} />
            {ORDER.map((cat) => (
              <CategoryRow
                key={cat}
                title={cat}
                channels={list.filter((c) => c.category === cat)}
                limit={BROWSE_LIMIT}
                onSelect={open}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
