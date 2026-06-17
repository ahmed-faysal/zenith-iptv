import { describe, it, expect } from "vitest";
import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("restores focus to the opener when it closes", async () => {
    // Harness mirrors the Player: an opener button toggles the sidebar.
    function Harness() {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);
      return (
        <div>
          <button ref={openerRef} onClick={() => setOpen(true)}>Channels</button>
          <ChannelSidebar
            channels={channels}
            open={open}
            onSelect={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />
        </div>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Channels" });
    opener.focus();
    await userEvent.click(opener);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveFocus();
    // Selecting a channel closes the sidebar; focus returns to the opener.
    await userEvent.keyboard("{Enter}");
    expect(opener).toHaveFocus();
  });
});
