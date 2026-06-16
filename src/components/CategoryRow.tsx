"use client";
import { useRef } from "react";
import type { Channel } from "@/lib/types";
import { ChannelCard } from "./ChannelCard";
import { useFocusNav } from "@/hooks/useFocusNav";

export function CategoryRow({
  title, channels, onSelect,
}: { title: string; channels: Channel[]; onSelect: (c: Channel) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  if (channels.length === 0) return null;
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ color: "#eee", margin: "0 0 12px 16px", fontSize: 20 }}>{title}</h2>
      <div
        ref={ref}
        style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px" }}
      >
        {channels.map((c) => (
          <ChannelCard key={c.id} channel={c} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
