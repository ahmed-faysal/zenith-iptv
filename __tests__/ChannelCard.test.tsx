import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelCard } from "@/components/ChannelCard";
import type { Channel } from "@/lib/types";

const ch: Channel = {
  id: "A.x", name: "Channel A", logo: "http://x/a.png",
  streamUrl: "http://x/a.m3u8", category: "News",
  languages: ["English"], countries: ["GB"],
};

describe("ChannelCard", () => {
  it("renders channel name", () => {
    render(<ChannelCard channel={ch} onSelect={() => {}} />);
    expect(screen.getByText("Channel A")).toBeInTheDocument();
  });
  it("calls onSelect when activated with Enter", async () => {
    const onSelect = vi.fn();
    render(<ChannelCard channel={ch} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Channel A/ });
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(ch);
  });
  it("is focusable for D-pad navigation", () => {
    render(<ChannelCard channel={ch} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Channel A/ }))
      .toHaveAttribute("data-focusable");
  });
});
