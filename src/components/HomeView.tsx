"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryRow } from "./CategoryRow";
import { SettingsPanel } from "./SettingsPanel";
import { TopBar } from "./TopBar";
import { useGridFocus } from "@/hooks/useGridFocus";
import { useChannels } from "@/hooks/useChannels";
import { topValues } from "@/lib/filters";
import { getFavorites, getRecents, getPrefs, setLastChannel, pushRecent, removeRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];
const TABS = ["All", ...ORDER]; // app-bar category filter; "All" shows every row
const ROW_LIMIT = 40; // cap huge category rows; the long tail lives in Search (#4)
const FILTER_OPTIONS = 24; // most-common languages/countries offered in Settings

export function HomeView() {
  const router = useRouter();
  const { channels, error } = useChannels();
  const [showSettings, setShowSettings] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("All");
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecents());
  const mainRef = useRef<HTMLElement>(null);

  // Initial focus once channels are on screen; cross-row nav is suspended while
  // the Settings modal is open (so it owns focus and the close doesn't re-grab).
  const ready = !!channels && !error;
  useGridFocus(mainRef, ready, ready && !showSettings);

  // Most-common languages/countries in the catalogue — drives the settings
  // pick-lists, capped so they stay navigable with a remote.
  const allLanguages = useMemo(
    () => topValues(channels ?? [], (c) => c.languages, FILTER_OPTIONS),
    [channels]
  );
  const allCountries = useMemo(
    () => topValues(channels ?? [], (c) => c.countries, FILTER_OPTIONS),
    [channels]
  );

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
  const recents = recentIds.map((id) => byId.get(id)).filter(Boolean) as Channel[];

  // The active tab narrows what's shown: "All" keeps the full layout; a category
  // shows just that row, with Favorites/Continue-Watching filtered to match.
  const inCat = (c: Channel) => activeCat === "All" || c.category === activeCat;
  const shownCats = activeCat === "All" ? ORDER : ([activeCat] as AppCategory[]);

  function open(c: Channel) {
    setLastChannel(c.id);
    pushRecent(c.id);
    setRecentIds(getRecents());
    router.push(`/watch/${encodeURIComponent(c.id)}`);
  }

  function removeFromRecents(c: Channel) {
    removeRecent(c.id);
    setRecentIds(getRecents());
  }

  return (
    <main ref={mainRef} className="home-main">
      <TopBar
        categories={TABS}
        activeCategory={activeCat}
        onCategory={setActiveCat}
        onSearch={() => router.push("/search")}
        onSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <SettingsPanel
          languages={allLanguages}
          countries={allCountries}
          onClose={() => { setShowSettings(false); router.refresh(); }}
        />
      )}
      <CategoryRow title="Favorites" channels={favorites.filter(inCat)} onSelect={open} />
      <CategoryRow title="Continue Watching" channels={recents.filter(inCat)} onSelect={open} onRemove={removeFromRecents} />
      {shownCats.map((cat) => (
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
