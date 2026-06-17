import type { Channel } from "./types";

export type ChannelsFetcher = () => Promise<Channel[]>;

const defaultFetcher: ChannelsFetcher = () =>
  fetch("/api/channels").then((r) => r.json()).then((d) => d.channels ?? []);

// Session-wide cache: the ~2.67 MB channel list is fetched once and shared
// across Home / Watch / Search instead of being re-downloaded per navigation.
let cache: Promise<Channel[]> | null = null;

export function loadChannels(fetcher: ChannelsFetcher = defaultFetcher): Promise<Channel[]> {
  if (!cache) {
    // Drop a rejected promise so a transient failure can be retried.
    cache = fetcher().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

export function __resetChannelsCache(): void {
  cache = null;
}
