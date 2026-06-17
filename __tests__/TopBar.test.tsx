import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "@/components/TopBar";

describe("TopBar", () => {
  it("renders focusable Search and Settings buttons in a row", () => {
    render(<TopBar onSearch={() => {}} onSettings={() => {}} />);
    const row = screen.getByRole("button", { name: /search/i }).closest("[data-row]");
    expect(row).not.toBeNull();
    expect(screen.getByRole("button", { name: /search/i })).toHaveAttribute("data-focusable");
    expect(screen.getByRole("button", { name: /settings/i })).toHaveAttribute("data-focusable");
  });

  it("calls onSearch when Search is activated", async () => {
    const onSearch = vi.fn();
    render(<TopBar onSearch={onSearch} onSettings={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onSettings when Settings is activated", async () => {
    const onSettings = vi.fn();
    render(<TopBar onSearch={() => {}} onSettings={onSettings} />);
    await userEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("moves focus from Search to Settings with ArrowRight", async () => {
    render(<TopBar onSearch={() => {}} onSettings={() => {}} />);
    screen.getByRole("button", { name: /search/i }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /settings/i })).toHaveFocus();
  });
});
