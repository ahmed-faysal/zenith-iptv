import type { Channel } from "./types";

export type ChannelsFetcher = () => Promise<Channel[]>;

const defaultFetcher: ChannelsFetcher = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  return fetch(`${base}/api/channels`, { signal: controller.signal })
    .then((r) => r.json())
    .then((d) => d.channels ?? [])
    .finally(() => clearTimeout(timer));
};

// Session-wide cache: the ~2.67 MB channel list is fetched once and shared
// across Home / Watch / Search instead of being re-downloaded per navigation.
// A factory so tests get an isolated cache without a production reset hook.
export function createChannelLoader(fetcher: ChannelsFetcher = defaultFetcher) {
  let cache: Promise<Channel[]> | null = null;
  return (): Promise<Channel[]> => {
    if (!cache) {
      // Drop a rejected promise so a transient failure can be retried.
      cache = fetcher().catch((err) => {
        cache = null;
        throw err;
      });
    }
    return cache;
  };
}

export const loadChannels = createChannelLoader();
