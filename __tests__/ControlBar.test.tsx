import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlBar } from "@/components/ControlBar";

describe("ControlBar", () => {
  it("shows the channel name", () => {
    render(
      <ControlBar channelName="BBC News" isFavorite={false}
        onToggleFavorite={() => {}} onOpenChannels={() => {}} />
    );
    expect(screen.getByText("BBC News")).toBeInTheDocument();
  });

  it("exposes focusable favorite and channels controls (reachable by D-pad)", () => {
    const { container } = render(
      <ControlBar channelName="X" isFavorite={false}
        onToggleFavorite={() => {}} onOpenChannels={() => {}} />
    );
    // Lives in a data-row so useGridFocus reaches it; buttons are data-focusable.
    expect(container.querySelector("[data-row]")).not.toBeNull();
    expect(container.querySelectorAll("[data-focusable]").length).toBe(2);
  });

  it("toggles favorite with the Enter key (remote OK)", async () => {
    const onToggleFavorite = vi.fn();
    render(
      <ControlBar channelName="X" isFavorite={false}
        onToggleFavorite={onToggleFavorite} onOpenChannels={() => {}} />
    );
    screen.getByLabelText("Add to favorites").focus();
    await userEvent.keyboard("{Enter}");
    expect(onToggleFavorite).toHaveBeenCalled();
  });

  it("opens the channel list with the Enter key", async () => {
    const onOpenChannels = vi.fn();
    render(
      <ControlBar channelName="X" isFavorite={false}
        onToggleFavorite={() => {}} onOpenChannels={onOpenChannels} />
    );
    screen.getByRole("button", { name: /channels/i }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenChannels).toHaveBeenCalled();
  });

  it("reflects the favorited state in the label", () => {
    render(
      <ControlBar channelName="X" isFavorite={true}
        onToggleFavorite={() => {}} onOpenChannels={() => {}} />
    );
    expect(screen.getByLabelText("Remove from favorites")).toBeInTheDocument();
  });
});
