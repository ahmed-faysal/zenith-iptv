import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { expandPlaybackUrls } from "@/lib/playback-urls";

HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();

const destroy = vi.fn();
const loadSource = vi.fn();
vi.mock("hls.js", () => {
  class FakeHls {
    static isSupported() { return true; }
    static Events = { MANIFEST_PARSED: "m", FRAG_BUFFERED: "f", ERROR: "e" };
    static ErrorTypes = { NETWORK_ERROR: "n", MEDIA_ERROR: "md" };
    loadSource = (...a: unknown[]) => loadSource(...a);
    attachMedia = vi.fn();
    on = vi.fn();
    destroy = () => destroy();
  }
  return { default: FakeHls };
});

// Mirrors WatchView: parent state (overlay auto-hide) re-renders the player,
// and `srcs` is computed inline, so it is a fresh array on every render.
function Harness({ urls = ["https://x/a.m3u8"] }: { urls?: string[] }) {
  const [chromeVisible, setChromeVisible] = useState(true);
  return (
    <>
      <button onClick={() => setChromeVisible((v) => !v)}>toggle-chrome</button>
      <VideoPlayer srcs={expandPlaybackUrls(urls, false)} />
      <span data-testid="chrome">{String(chromeVisible)}</span>
    </>
  );
}

describe("VideoPlayer playback stability", () => {
  beforeEach(() => { destroy.mockClear(); loadSource.mockClear(); });

  it("keeps the stream alive when the parent re-renders with an equal src list", () => {
    const { getByText } = render(<Harness />);
    act(() => { getByText("toggle-chrome").click(); }); // overlay auto-hides
    expect(destroy).not.toHaveBeenCalled();
  });

  it("does not reload the source on an unrelated parent re-render", () => {
    const { getByText } = render(<Harness />);
    loadSource.mockClear();
    act(() => { getByText("toggle-chrome").click(); });
    expect(loadSource).not.toHaveBeenCalled();
  });

  it("still reloads when the src list actually changes", () => {
    const { rerender } = render(<Harness urls={["https://x/a.m3u8"]} />);
    loadSource.mockClear();
    rerender(<Harness urls={["https://x/b.m3u8"]} />);
    expect(loadSource).toHaveBeenCalledWith("https://x/b.m3u8");
  });
});
