import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";
import { SearchView } from "@/components/SearchView";
import type { Channel } from "@/lib/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const ch: Channel = {
  id: "CNN.us@HD", name: "CNN", logo: "",
  streamUrls: ["http://x/cnn"], category: "News",
  languages: ["English"], countries: ["US"],
};

vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({ channels: [ch], error: false }),
}));
vi.mock("@/hooks/useEpg", () => ({ useEpg: () => ({}) }));
vi.mock("@/lib/storage", () => ({
  getFavorites: () => [],
  getRecents: () => [],
  getPrefs: () => ({ languages: [], countries: [] }),
  setLastChannel: vi.fn(),
  pushRecent: vi.fn(),
  removeRecent: vi.fn(),
}));

beforeEach(() => { push.mockClear(); });

describe("watch navigation uses query param", () => {
  it("BrowseView open() pushes /watch?id=", async () => {
    render(<BrowseView />);
    const card = await screen.findByText("CNN");
    await userEvent.click(card);
    expect(push).toHaveBeenCalledWith(
      `/watch?id=${encodeURIComponent("CNN.us@HD")}`,
    );
  });

  it("SearchView open() pushes /watch?id=", async () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText("Search channels…");
    await userEvent.type(input, "CNN");
    const card = await screen.findByText("CNN");
    await userEvent.click(card);
    expect(push).toHaveBeenCalledWith(
      `/watch?id=${encodeURIComponent("CNN.us@HD")}`,
    );
  });
});
