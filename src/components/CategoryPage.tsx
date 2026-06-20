"use client";
import { useRef, useState } from "react";
import type { Channel } from "@/lib/types";
import { ChannelCard } from "./ChannelCard";
import { useFocusNav } from "@/hooks/useFocusNav";

const PAGE_SIZE = 48;

export function CategoryPage({ title, channels, onSelect }: {
  title: string;
  channels: Channel[];
  onSelect: (c: Channel) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const gridRef = useRef<HTMLDivElement>(null);
  useFocusNav(gridRef, { orientation: "grid" });

  if (channels.length === 0) return null;

  const shown = channels.slice(0, limit);
  const remaining = channels.length - limit;

  return (
    <section className="cat-page">
      <div className="cat-page__head">
        <h2 className="cat-page__title">{title}</h2>
        <span className="cat-page__count">{channels.length}</span>
      </div>
      <div ref={gridRef} className="cat-page__grid">
        {shown.map((c) => (
          <ChannelCard key={c.id} channel={c} onSelect={onSelect} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="cat-page__more-wrap">
          <button
            className="cat-page__more"
            data-focusable
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            Show more
            <span className="cat-page__more-count">{remaining} remaining</span>
          </button>
        </div>
      )}
    </section>
  );
}
