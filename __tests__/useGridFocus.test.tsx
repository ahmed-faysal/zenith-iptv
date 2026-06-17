import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGridFocus } from "@/hooks/useGridFocus";

// Harness: a container with two "rows" of focusable buttons (a 3-wide row
// above a 2-wide row), driven by the hook under test.
function Grid({ ready = true }: { ready?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useGridFocus(ref, ready);
  return (
    <div ref={ref}>
      <div data-row>
        <button data-focusable>r0c0</button>
        <button data-focusable>r0c1</button>
        <button data-focusable>r0c2</button>
      </div>
      <div data-row>
        <button data-focusable>r1c0</button>
        <button data-focusable>r1c1</button>
      </div>
    </div>
  );
}

describe("useGridFocus", () => {
  it("focuses the first card on mount when ready", () => {
    render(<Grid ready />);
    expect(screen.getByText("r0c0")).toHaveFocus();
  });

  it("does not focus anything while not ready", () => {
    render(<Grid ready={false} />);
    expect(document.body).toHaveFocus();
  });

  it("focuses the first card once ready turns true", () => {
    const { rerender } = render(<Grid ready={false} />);
    expect(document.body).toHaveFocus();
    rerender(<Grid ready />);
    expect(screen.getByText("r0c0")).toHaveFocus();
  });

  it("ArrowDown moves to the same column in the next row", async () => {
    render(<Grid ready />);
    screen.getByText("r0c1").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByText("r1c1")).toHaveFocus();
  });

  it("ArrowDown clamps to the last card when the next row is shorter", async () => {
    render(<Grid ready />);
    screen.getByText("r0c2").focus(); // column 2; next row has only columns 0,1
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByText("r1c1")).toHaveFocus();
  });

  it("ArrowUp moves to the same column in the previous row", async () => {
    render(<Grid ready />);
    screen.getByText("r1c0").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText("r0c0")).toHaveFocus();
  });

  it("ArrowDown on the last row keeps focus put", async () => {
    render(<Grid ready />);
    screen.getByText("r1c0").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByText("r1c0")).toHaveFocus();
  });
});
