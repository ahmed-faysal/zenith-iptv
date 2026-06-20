"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, AppCategory } from "@/lib/types";
import { CategoryPage } from "./CategoryPage";
import { CategoryRow } from "./CategoryRow";
import { SettingsPanel } from "./SettingsPanel";
import { TopBar } from "./TopBar";
import { useGridFocus } from "@/hooks/useGridFocus";
import { useChannels } from "@/hooks/useChannels";
import { topValues } from "@/lib/filters";
import { getFavorites, getRecents, getPrefs, setLastChannel, pushRecent, removeRecent } from "@/lib/storage";

const ORDER: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];
const TABS = ["All", ...ORDER];
const FILTER_OPTIONS = 24;

export function CategoryView({ category }: { category: AppCategory }) {
  const router = useRouter();
  const { channels, error } = useChannels();
  const [showSettings, setShowSettings] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecents());
  const mainRef = useRef<HTMLElement>(null);

  const ready = !!channels && !error;
  useGridFocus(mainRef, ready, ready && !showSettings);

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
  const inCat = (c: Channel) => c.category === category;

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

  function handleCategory(cat: string) {
    if (cat === "All") router.push("/");
    else router.push(`/category/${cat.toLowerCase()}`);
  }

  return (
    <main ref={mainRef} className="home-main">
      <TopBar
        categories={TABS}
        activeCategory={category}
        onCategory={handleCategory}
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
      <CategoryRow
        title="Continue Watching"
        channels={recents.filter(inCat)}
        onSelect={open}
        onRemove={removeFromRecents}
      />
      <CategoryPage
        title={category}
        channels={filtered.filter(inCat)}
        onSelect={open}
      />
    </main>
  );
}
