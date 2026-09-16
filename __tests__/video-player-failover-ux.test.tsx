import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { DEAD_SOURCE_TIMEOUT_MS, hlsConfig } from "@/lib/player";

HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();

const loadSource = vi.fn();
vi.mock("hls.js", () => {
  class FakeHls {
    static isSupported() { return true; }
    static Events = { MANIFEST_PARSED: "m", FRAG_BUFFERED: "f", ERROR: "e" };
    static ErrorTypes = { NETWORK_ERROR: "n", MEDIA_ERROR: "md" };
    loadSource = (...a: unknown[]) => loadSource(...a);
    attachMedia = vi.fn();
    on = vi.fn();
    destroy = vi.fn();
  }
  return { default: FakeHls };
});

const URLS = ["https://x/a.m3u8", "https://x/b.m3u8", "https://x/c.m3u8"];

describe("failover feedback while sources are tried", () => {
  beforeEach(() => { vi.useFakeTimers(); loadSource.mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("gives up on a silent source within the dead-source budget", () => {
    render(<VideoPlayer srcs={URLS} />);
    expect(loadSource).toHaveBeenCalledWith("https://x/a.m3u8");
    act(() => { vi.advanceTimersByTime(DEAD_SOURCE_TIMEOUT_MS + 50); });
    expect(loadSource).toHaveBeenCalledWith("https://x/b.m3u8");
  });

  it("names which source is being tried so a slow channel is not mistaken for a hang", () => {
    const { getByText } = render(<VideoPlayer srcs={URLS} />);
    act(() => { vi.advanceTimersByTime(DEAD_SOURCE_TIMEOUT_MS + 50); });
    expect(getByText("Trying source 2 of 3…")).toBeTruthy();
  });

  it("keeps every source attempt inside a couch-tolerable total wait", () => {
    // 3 dead sources must resolve to "unavailable" in well under half a minute.
    expect(DEAD_SOURCE_TIMEOUT_MS * URLS.length).toBeLessThanOrEqual(30_000);
  });

  it("lets hls.js time out first so its error path runs before our backstop", () => {
    // Our timer is only for a server that accepts the socket and then goes
    // silent. If it fired first it would also kill a slow-but-working manifest.
    const cfg = hlsConfig();
    expect(cfg.manifestLoadingTimeOut).toBeLessThan(DEAD_SOURCE_TIMEOUT_MS);
    expect(cfg.levelLoadingTimeOut).toBeLessThan(DEAD_SOURCE_TIMEOUT_MS);
  });
});
