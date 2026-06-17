"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { useChannels } from "@/hooks/useChannels";
import { setLastChannel, pushRecent, toggleFavorite, isFavorite } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const { channels: loaded } = useChannels();
  const channels = loaded ?? [];
  // The route's channel by default; a sidebar pick swaps it in place.
  const [override, setOverride] = useState<Channel | null>(null);
  const active = override ?? channels.find((c) => c.id === channelId) ?? null;
  const [sidebar, setSidebar] = useState(false);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLastChannel(active.id);
    pushRecent(active.id);
    setFav(isFavorite(active.id));
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
      </div>
      <ChannelSidebar channels={channels} open={sidebar} onSelect={(c) => { setOverride(c); setSidebar(false); }} />
    </div>
  );
}
