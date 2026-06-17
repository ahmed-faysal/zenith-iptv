"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { SettingsPanel } from "./SettingsPanel";
import { TopBar } from "./TopBar";
import { useGridFocus } from "@/hooks/useGridFocus";
import { useChannels } from "@/hooks/useChannels";
import { getFavorites, getRecents, getPrefs, setLastChannel, pushRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];
const ROW_LIMIT = 40; // cap huge category rows; the long tail lives in Search (#4)

export function HomeView() {
  const router = useRouter();
  const { channels, error } = useChannels();
  const [showSettings, setShowSettings] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Cross-row D-pad navigation + initial focus once channels are on screen.
  useGridFocus(mainRef, !!channels && !error && !showSettings);

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
    <main ref={mainRef} style={{ paddingTop: 16 }}>
      <h1 style={{ margin: "0 0 16px 16px" }}>Live TV</h1>
      <TopBar
        onSearch={() => router.push("/search")}
        onSettings={() => setShowSettings(true)}
      />
      {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); router.refresh(); }} />}
      <CategoryRow title="Favorites" channels={favorites} onSelect={open} />
      <CategoryRow title="Continue Watching" channels={recents} onSelect={open} />
      {ORDER.map((cat) => (
        <CategoryRow
          key={cat}
          title={cat}
          channels={filtered.filter((c) => c.category === cat)}
          limit={ROW_LIMIT}
          onSelect={open}
        />
      ))}
    </main>
  );
}
