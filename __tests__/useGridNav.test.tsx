import { describe, it, expect, beforeEach } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGridNav } from "@/hooks/useGridNav";

// Harness: 5 cards in a grid the test pretends is 2 columns wide by stubbing
// offsetTop (jsdom reports 0 for everything otherwise). Rows: [0,1] [2,3] [4].
function Grid() {
  const ref = useRef<HTMLDivElement>(null);
  useGridNav(ref);
  return (
    <div ref={ref}>
      {[0, 1, 2, 3, 4].map((n) => (
        <button key={n} data-focusable>c{n}</button>
      ))}
    </div>
  );
}

function asTwoColumns() {
  // Stub offsetTop so cards 0,1 share row 0; 2,3 row 1; 4 row 2.
  const tops = [0, 0, 100, 100, 200];
  screen.getAllByRole("button").forEach((b, idx) => {
    Object.defineProperty(b, "offsetTop", { configurable: true, value: tops[idx] });
  });
}

describe("useGridNav", () => {
  beforeEach(() => {
    render(<Grid />);
    asTwoColumns();
  });

  it("ArrowRight moves to the next card", async () => {
    screen.getByText("c0").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("c1")).toHaveFocus();
  });

  it("ArrowLeft moves to the previous card", async () => {
    screen.getByText("c3").focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("c2")).toHaveFocus();
  });

  it("ArrowDown moves down a whole row (by column count)", async () => {
    screen.getByText("c1").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByText("c3")).toHaveFocus();
  });

  it("ArrowUp moves up a whole row", async () => {
    screen.getByText("c3").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText("c1")).toHaveFocus();
  });

  it("leaves focus put when a move would exit the grid (bubbles instead)", async () => {
    screen.getByText("c0").focus();
    await userEvent.keyboard("{ArrowUp}"); // above the top row -> out of range
    expect(screen.getByText("c0")).toHaveFocus();
  });
});
