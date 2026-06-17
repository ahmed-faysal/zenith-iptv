import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlBar } from "@/components/ControlBar";

const base = {
  channelName: "X",
  isFavorite: false,
  isPaused: false,
  onToggleFavorite: () => {},
  onTogglePlay: () => {},
  onOpenChannels: () => {},
};

describe("ControlBar", () => {
  it("shows the channel name", () => {
    render(<ControlBar {...base} channelName="BBC News" />);
    expect(screen.getByText("BBC News")).toBeInTheDocument();
  });

  it("exposes focusable play, favorite and channels controls (reachable by D-pad)", () => {
    const { container } = render(<ControlBar {...base} />);
    // Lives in a data-row so useGridFocus reaches it; buttons are data-focusable.
    expect(container.querySelector("[data-row]")).not.toBeNull();
    expect(container.querySelectorAll("[data-focusable]").length).toBe(3);
  });

  it("toggles play/pause with the Enter key (remote OK)", async () => {
    const onTogglePlay = vi.fn();
    render(<ControlBar {...base} onTogglePlay={onTogglePlay} />);
    screen.getByLabelText("Pause").focus();
    await userEvent.keyboard("{Enter}");
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it("shows a Play affordance when paused", () => {
    render(<ControlBar {...base} isPaused={true} />);
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("toggles favorite with the Enter key (remote OK)", async () => {
    const onToggleFavorite = vi.fn();
    render(<ControlBar {...base} onToggleFavorite={onToggleFavorite} />);
    screen.getByLabelText("Add to favorites").focus();
    await userEvent.keyboard("{Enter}");
    expect(onToggleFavorite).toHaveBeenCalled();
  });

  it("opens the channel list with the Enter key", async () => {
    const onOpenChannels = vi.fn();
    render(<ControlBar {...base} onOpenChannels={onOpenChannels} />);
    screen.getByRole("button", { name: /channels/i }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenChannels).toHaveBeenCalled();
  });

  it("reflects the favorited state in the label", () => {
    render(<ControlBar {...base} isFavorite={true} />);
    expect(screen.getByLabelText("Remove from favorites")).toBeInTheDocument();
  });
});
