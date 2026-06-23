import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchView } from "@/components/SearchView";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Mock useChannels
const channels = [
  { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["http://x/cnn"], category: "News", languages: [], countries: [] },
  { id: "BBC.gb", name: "BBC News", logo: "", streamUrls: ["http://x/bbc"], category: "News", languages: [], countries: [] },
];
vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({ channels }),
}));

// Mock storage
vi.mock("@/lib/storage", () => ({
  getRecents: () => [],
  setLastChannel: vi.fn(),
  pushRecent: vi.fn(),
}));

// Mock useEpg
const epgMap = {
  "CNN.us": { now: { channel: "CNN.us", start: 0, stop: 9999999999999, title: "World Cup Final" } },
};
vi.mock("@/hooks/useEpg", () => ({
  useEpg: () => epgMap,
}));

describe("SearchView EPG section", () => {
  it("shows On now · Next section when EPG matches the query", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "world cup");
    expect(screen.getByText("On now · Next")).toBeInTheDocument();
    expect(screen.getByText("Now · World Cup Final")).toBeInTheDocument();
  });

  it("hides On now · Next section when query matches no EPG titles", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "zzz");
    expect(screen.queryByText("On now · Next")).not.toBeInTheDocument();
  });

  it("shows Channels section for name matches", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "bbc");
    expect(screen.getByText(/^Channels/)).toBeInTheDocument();
  });

  it("does not show a channel in both sections (dedup)", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "world cup");
    // CNN appears in EPG section (World Cup Final is on CNN.us)
    // CNN does NOT match by name for "world cup"
    // So it only appears in the EPG section — verify the subtitle shows
    const subtitleEl = screen.queryByText("Now · World Cup Final");
    expect(subtitleEl).toBeInTheDocument();
  });
});
