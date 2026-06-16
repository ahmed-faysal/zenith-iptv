"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { SettingsPanel } from "./SettingsPanel";
import { getFavorites, getRecents, getPrefs, setLastChannel, pushRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];

export function HomeView() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels ?? []))
      .catch(() => setError(true));
  }, []);

  if (error) return <p style={{ padding: 24 }}>Could not load channels. Please retry later.</p>;
  if (!channels) return <p style={{ padding: 24 }}>Loading channels…</p>;

  const prefs = getPrefs();
  const filtered = channels.filter((c) => {
    const langOk = prefs.languages.length === 0 || c.languages.some((l) => prefs.languages.includes(l));
    const ctryOk = prefs.countries.length === 0 || c.countries.some((c2) => prefs.countries.includes(c2));
    return langOk && ctryOk;
  });

  const byId = new Map(filtered.map((c) => [c.id, c]));
  const favorites = getFavorites().map((id) => byId.get(id)).filter(Boolean) as Channel[];
  const recents = getRecents().map((id) => byId.get(id)).filter(Boolean) as Channel[];

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  return (
    <main style={{ paddingTop: 16 }}>
      <h1 style={{ margin: "0 0 24px 16px" }}>Live TV</h1>
      <button onClick={() => setShowSettings(true)} style={{ marginLeft: 16 }}>⚙ Settings</button>
      {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); router.refresh(); }} />}
      <CategoryRow title="Favorites" channels={favorites} onSelect={open} />
      <CategoryRow title="Continue Watching" channels={recents} onSelect={open} />
      {ORDER.map((cat) => (
        <CategoryRow
          key={cat}
          title={cat}
          channels={filtered.filter((c) => c.category === cat)}
          onSelect={open}
        />
      ))}
    </main>
  );
}
