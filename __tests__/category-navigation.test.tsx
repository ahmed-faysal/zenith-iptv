import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowseView } from "@/components/BrowseView";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({
    channels: [
      { id: "CNN.us", name: "CNN", logo: "", streamUrls: ["http://x/cnn"],
        category: "News", languages: [], countries: [] },
    ],
    error: false,
  }),
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

describe("category navigation uses query param", () => {
  it("BrowseView goToCategory() pushes /category?slug=", async () => {
    render(<BrowseView />);
    // TopBar renders category tabs; click "News"
    const tab = await screen.findByRole("button", { name: "News" });
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/category?slug=news");
  });

  it("goToCategory('All') still pushes /", async () => {
    render(<BrowseView />);
    const tab = await screen.findByRole("button", { name: "All" });
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/");
  });
});
