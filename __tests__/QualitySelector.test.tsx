import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QualitySelector } from "@/components/QualitySelector";

describe("QualitySelector", () => {
  it("renders nothing for a single-level stream", () => {
    const { container } = render(
      <QualitySelector levels={[{ height: 720 }]} current={-1} onSelect={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
  it("renders Auto plus each level when multiple", () => {
    render(
      <QualitySelector
        levels={[{ height: 1080 }, { height: 720 }, { height: 480 }]}
        current={-1}
        onSelect={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1080p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "480p" })).toBeInTheDocument();
  });
  it("calls onSelect with the level index", async () => {
    const onSelect = vi.fn();
    render(
      <QualitySelector
        levels={[{ height: 1080 }, { height: 720 }]}
        current={-1}
        onSelect={onSelect}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "720p" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
