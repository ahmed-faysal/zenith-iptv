import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryRow } from "@/components/CategoryRow";
import type { Channel } from "@/lib/types";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrls: ["http://x/" + id], category: "News",
  languages: [], countries: [],
});
const channels = [make("a", "Alpha"), make("b", "Bravo"), make("c", "Cara")];

describe("CategoryRow", () => {
  it("renders title and all cards", () => {
    render(<CategoryRow title="News" channels={channels} onSelect={() => {}} />);
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
  it("moves focus right with ArrowRight", async () => {
    render(<CategoryRow title="News" channels={channels} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(buttons[1]).toHaveFocus();
  });
  it("caps rendered cards at the given limit", () => {
    const many = Array.from({ length: 100 }, (_, i) => make("c" + i, "Ch " + i));
    render(<CategoryRow title="Other" channels={many} limit={40} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(40);
  });
  it("renders all cards when no limit is given", () => {
    const many = Array.from({ length: 50 }, (_, i) => make("c" + i, "Ch " + i));
    render(<CategoryRow title="Other" channels={many} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(50);
  });
  it("passes subtitle to ChannelCard via subtitleFor", () => {
    const subtitleFor = (c: Channel) => c.id === "a" ? "Now · Test Show" : undefined;
    render(
      <CategoryRow
        title="News"
        channels={channels}
        onSelect={() => {}}
        subtitleFor={subtitleFor}
      />
    );
    expect(screen.getByText("Now · Test Show")).toBeInTheDocument();
  });
});
