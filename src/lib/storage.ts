import type { Prefs } from "./types";

const KEYS = {
  fav: "ltv.favorites",
  recents: "ltv.recents",
  last: "ltv.lastChannel",
  prefs: "ltv.prefs",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFavorites(): string[] { return read(KEYS.fav, []); }
export function isFavorite(id: string): boolean { return getFavorites().includes(id); }
export function toggleFavorite(id: string): void {
  const cur = getFavorites();
  write(KEYS.fav, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
}

export function getRecents(): string[] { return read(KEYS.recents, []); }
export function pushRecent(id: string): void {
  const next = [id, ...getRecents().filter((x) => x !== id)].slice(0, 10);
  write(KEYS.recents, next);
}

export function getLastChannel(): string | null { return read<string | null>(KEYS.last, null); }
export function setLastChannel(id: string): void { write(KEYS.last, id); }

export function getPrefs(): Prefs { return read(KEYS.prefs, { languages: [], countries: [] }); }
export function setPrefs(p: Prefs): void { write(KEYS.prefs, p); }
