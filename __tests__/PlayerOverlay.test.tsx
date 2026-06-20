import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerOverlay } from "@/components/PlayerOverlay";

const base = {
  channelName: "Bloomberg Markets",
  channelSubtitle: "Financial news and market data",
  isPaused: false,
  isFavorite: false,
  volume: 0.8,
  muted: false,
  levels: [] as { height: number }[],
  currentLevel: -1,
  onTogglePlay: () => {},
  onToggleFavorite: () => {},
  onBack: () => {},
  onVolumeChange: () => {},
  onToggleMute: () => {},
  onFullscreen: () => {},
  onSelectLevel: () => {},
};

describe("PlayerOverlay", () => {
  it("shows the channel name, subtitle and a LIVE badge", () => {
    render(<PlayerOverlay {...base} />);
    expect(screen.getByText("Bloomberg Markets")).toBeInTheDocument();
    expect(screen.getByText("Financial news and market data")).toBeInTheDocument();
    expect(screen.getAllByText(/live/i).length).toBeGreaterThanOrEqual(1);
  });

  it("lays out focusable controls across multiple grid rows", () => {
    const { container } = render(<PlayerOverlay {...base} />);
    // top bar, center, bottom row -> at least 3 data-rows for vertical D-pad nav
    expect(container.querySelectorAll("[data-row]").length).toBeGreaterThanOrEqual(3);
    // Back, Play/Pause, Favorite, Mute, Fullscreen
    expect(container.querySelectorAll("[data-focusable]").length).toBeGreaterThanOrEqual(5);
  });

  it("toggles play with the center control (Enter)", async () => {
    const onTogglePlay = vi.fn();
    render(<PlayerOverlay {...base} onTogglePlay={onTogglePlay} />);
    screen.getByLabelText("Pause").focus();
    await userEvent.keyboard("{Enter}");
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it("shows a Play affordance when paused", () => {
    render(<PlayerOverlay {...base} isPaused={true} />);
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("calls onBack from the back button", async () => {
    const onBack = vi.fn();
    render(<PlayerOverlay {...base} onBack={onBack} />);
    screen.getByLabelText("Back").focus();
    await userEvent.keyboard("{Enter}");
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onFullscreen from the fullscreen button", async () => {
    const onFullscreen = vi.fn();
    render(<PlayerOverlay {...base} onFullscreen={onFullscreen} />);
    screen.getByLabelText("Fullscreen").focus();
    await userEvent.keyboard("{Enter}");
    expect(onFullscreen).toHaveBeenCalled();
  });

  it("toggles mute and reports volume changes", async () => {
    const onToggleMute = vi.fn();
    const onVolumeChange = vi.fn();
    render(<PlayerOverlay {...base} onToggleMute={onToggleMute} onVolumeChange={onVolumeChange} />);
    screen.getByLabelText("Mute").focus();
    await userEvent.keyboard("{Enter}");
    expect(onToggleMute).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.5" } });
    expect(onVolumeChange).toHaveBeenCalledWith(0.5);
  });

  it("hides the quality control when there is only one rendition", () => {
    render(<PlayerOverlay {...base} levels={[{ height: 720 }]} currentLevel={-1} />);
    expect(screen.queryByRole("button", { name: /quality/i })).toBeNull();
  });

  it("collapses quality into one button showing the current rendition", () => {
    render(<PlayerOverlay {...base} levels={[{ height: 1080 }, { height: 720 }]} currentLevel={0} />);
    const q = screen.getByRole("button", { name: /quality/i });
    expect(q).toHaveTextContent("1080p");
    // options are hidden until the button is opened
    expect(screen.queryByRole("button", { name: "720p" })).toBeNull();
  });

  it("opens the options on click and reports the chosen level", async () => {
    const onSelectLevel = vi.fn();
    render(
      <PlayerOverlay {...base} levels={[{ height: 1080 }, { height: 720 }]} currentLevel={-1}
        onSelectLevel={onSelectLevel} />
    );
    await userEvent.click(screen.getByRole("button", { name: /quality/i }));
    await userEvent.click(screen.getByRole("button", { name: "720p" }));
    expect(onSelectLevel).toHaveBeenCalledWith(1);
  });

  it("is hidden from assistive tech and pointer when not visible", () => {
    const { container } = render(<PlayerOverlay {...base} visible={false} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
