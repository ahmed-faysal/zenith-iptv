"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, EpgEntry } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { setLastChannel, pushRecent, toggleFavorite, isFavorite } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [epg, setEpg] = useState<EpgEntry>({});
  const [sidebar, setSidebar] = useState(false);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((d) => {
      const list: Channel[] = d.channels ?? [];
      setChannels(list);
      setActive(list.find((c) => c.id === channelId) ?? null);
    });
  }, [channelId]);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
    setFav(isFavorite(active.id));
    fetch(`/api/epg?channelId=${encodeURIComponent(active.id)}`)
      .then((r) => r.json()).then(setEpg).catch(() => setEpg({}));
  }, [active]);

  function toggleFav() {
    if (!active) return;
    toggleFavorite(active.id);
    setFav(isFavorite(active.id));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && !sidebar) setSidebar(true);
      if (e.key === "ArrowRight" && sidebar) setSidebar(false);
      if (e.key === "Backspace" || e.key === "Escape") router.push("/");
      if (e.key.toLowerCase() === "f") toggleFav();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebar, router, active]);

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <VideoPlayer src={active.streamUrl} />
      <div style={{ position: "absolute", top: 16, left: 16, color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={toggleFav}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          title="Favorite (F)"
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: fav ? "#ffd24d" : "#fff" }}
        >
          {fav ? "★" : "☆"}
        </button>
        <strong>{active.name}</strong>
        {epg.now && <span style={{ opacity: 0.8 }}>{epg.now.title}</span>}
      </div>
      <ChannelSidebar channels={channels} open={sidebar} onSelect={(c) => { setActive(c); setSidebar(false); }} />
    </div>
  );
}
