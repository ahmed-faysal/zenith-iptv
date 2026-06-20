"use client";
import { useRef } from "react";
import type { Channel } from "@/lib/types";
import { ChannelCard } from "./ChannelCard";
import { useFocusNav } from "@/hooks/useFocusNav";

export function CategoryRow({
  title, channels, onSelect, onRemove, onSeeAll, limit,
}: {
  title: string;
  channels: Channel[];
  onSelect: (c: Channel) => void;
  onRemove?: (c: Channel) => void;
  onSeeAll?: () => void;
  limit?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusNav(ref, { orientation: "horizontal" });

  if (channels.length === 0) return null;
  const shown = limit ? channels.slice(0, limit) : channels;
  const hasMore = limit !== undefined && channels.length > limit;
  return (
    <section className="cat-row">
      <div className="cat-row__head">
        <h2 className="cat-row__title">{title}</h2>
        <span className="cat-row__count">{channels.length}</span>
        {onSeeAll && hasMore && (
          <button className="cat-row__see-all" onClick={onSeeAll}>
            See all <span aria-hidden>›</span>
          </button>
        )}
      </div>
      <div ref={ref} data-row className="cat-row__track">
        {shown.map((c) =>
          onRemove ? (
            <div key={c.id} className="card-wrap">
              <ChannelCard channel={c} onSelect={onSelect} />
              <button
                className="card-remove"
                aria-label={`Remove ${c.name} from Continue Watching`}
                onClick={(e) => { e.stopPropagation(); onRemove(c); }}
              >
                ✕
              </button>
            </div>
          ) : (
            <ChannelCard key={c.id} channel={c} onSelect={onSelect} />
          )
        )}
      </div>
    </section>
  );
}
