"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, EpgEntry } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { ChannelSidebar } from "./ChannelSidebar";
import { setLastChannel, pushRecent } from "@/lib/storage";

export function WatchView({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [epg, setEpg] = useState<EpgEntry>({});
  const [sidebar, setSidebar] = useState(false);

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
    fetch(`/api/epg?channelId=${encodeURIComponent(active.id)}`)
      .then((r) => r.json()).then(setEpg).catch(() => setEpg({}));
  }, [active]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && !sidebar) setSidebar(true);
      if (e.key === "ArrowRight" && sidebar) setSidebar(false);
      if (e.key === "Backspace" || e.key === "Escape") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebar, router]);

  if (!active) return <p style={{ padding: 24 }}>Loading channel…</p>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <VideoPlayer src={active.streamUrl} />
      <div style={{ position: "absolute", top: 16, left: 16, color: "#fff" }}>
        <strong>{active.name}</strong>
        {epg.now && <span style={{ marginLeft: 12, opacity: 0.8 }}>{epg.now.title}</span>}
      </div>
      <ChannelSidebar channels={channels} open={sidebar} onSelect={(c) => { setActive(c); setSidebar(false); }} />
    </div>
  );
}
