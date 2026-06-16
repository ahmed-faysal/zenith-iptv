"use client";
import type { Channel } from "@/lib/types";

export function ChannelCard({
  channel, onSelect,
}: { channel: Channel; onSelect: (c: Channel) => void }) {
  return (
    <button
      data-focusable
      onClick={() => onSelect(channel)}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(channel); }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        width: 160, padding: 12, background: "#161616", color: "#eee",
        border: "2px solid transparent", borderRadius: 12, cursor: "pointer",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "#4da3ff")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
    >
      {channel.logo
        ? <img src={channel.logo} alt="" width={96} height={54} style={{ objectFit: "contain" }} />
        : <div style={{ width: 96, height: 54, background: "#333", borderRadius: 6 }} />}
      <span style={{ marginTop: 8, fontWeight: 600, textAlign: "center" }}>{channel.name}</span>
      {channel.nowPlaying && (
        <span style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>{channel.nowPlaying}</span>
      )}
    </button>
  );
}
