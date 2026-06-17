import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import type { Channel } from "@/lib/types";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrl: "http://x/" + id, category: "News",
  languages: [], countries: [],
});
const channels = [make("a", "Alpha"), make("b", "Bravo")];

describe("ChannelSidebar", () => {
  it("focuses the first channel when it opens", () => {
    const { rerender } = render(
      <ChannelSidebar channels={channels} open={false} onSelect={() => {}} />
    );
    expect(document.body).toHaveFocus();
    rerender(<ChannelSidebar channels={channels} open={true} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveFocus();
  });

  it("does not steal focus while closed", () => {
    render(<ChannelSidebar channels={channels} open={false} onSelect={() => {}} />);
    expect(document.body).toHaveFocus();
  });
});
