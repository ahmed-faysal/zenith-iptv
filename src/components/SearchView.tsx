"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { setLastChannel, pushRecent } from "@/lib/storage";

export function SearchView() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => setChannels(d.channels ?? []));
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return channels.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 60);
  }, [q, channels]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <main style={{ padding: 16 }}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search channels…"
        style={{ width: "100%", maxWidth: 480, padding: 12, fontSize: 18, borderRadius: 8, border: "1px solid #333", background: "#161616", color: "#eee" }}
      />
      <div style={{ marginTop: 24 }}>
        <CategoryRow title={`Results (${results.length})`} channels={results} onSelect={open} />
      </div>
    </main>
  );
}
