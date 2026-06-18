"use client";
import { useState } from "react";
import type { Channel } from "@/lib/types";
import { parseChannelName, isHd } from "@/lib/channel-name";

// A poster-style channel tile: a frosted "logo plate" with a quality chip, the
// clean title, and any status flags. Focus styling (scale + ring + glow) lives
// in globals.css via the .channel-card class so it's uniform with the D-pad.
export function ChannelCard({
  channel, onSelect,
}: { channel: Channel; onSelect: (c: Channel) => void }) {
  const [broken, setBroken] = useState(false);
  const { title, quality, flags } = parseChannelName(channel.name);

  return (
    <button
      className="channel-card"
      data-focusable
      onClick={() => onSelect(channel)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelect(channel); } }}
    >
      <span className="channel-card__plate">
        {channel.logo && !broken ? (
          <img
            src={channel.logo}
            alt=""
            loading="lazy"
            className="channel-card__logo"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="channel-card__fallback" aria-hidden>
            {title.slice(0, 2).toUpperCase()}
          </span>
        )}
        {quality && (
          <span className={`channel-card__quality${isHd(quality) ? " is-hd" : ""}`}>
            {isHd(quality) ? "HD" : quality}
          </span>
        )}
      </span>
      <span className="channel-card__title">{title}</span>
      {flags.length > 0 && (
        <span className="channel-card__flags">{flags.join(" · ")}</span>
      )}
    </button>
  );
}
