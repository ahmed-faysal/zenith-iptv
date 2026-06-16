import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryRow } from "@/components/CategoryRow";
import type { Channel } from "@/lib/types";

const make = (id: string, name: string): Channel => ({
  id, name, logo: "", streamUrl: "http://x/" + id, category: "News",
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
});
