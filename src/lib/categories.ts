import type { AppCategory } from "./types";

const RULES: [AppCategory, string[]][] = [
  ["News", ["news", "politics"]],
  ["Sports", ["sport", "sports"]],
  ["Music", ["music"]],
  ["Kids", ["kids", "children", "cartoon"]],
  ["Entertainment", ["movies", "series", "entertainment", "general", "comedy", "drama"]],
];

export function toAppCategory(groups: string[]): AppCategory {
  const haystack = groups.map((g) => g.toLowerCase());
  for (const [category, keywords] of RULES) {
    if (haystack.some((g) => keywords.some((k) => g.includes(k)))) {
      return category;
    }
  }
  return "Other";
}

// iptv-org canonical category ids → our AppCategory. Content genres collapse
// into Entertainment; only a handful map to the named buckets.
const CANON: Record<string, AppCategory> = {
  news: "News",
  sports: "Sports",
  music: "Music",
  kids: "Kids", family: "Kids",
  entertainment: "Entertainment", movies: "Entertainment", series: "Entertainment",
  general: "Entertainment", comedy: "Entertainment", drama: "Entertainment",
  animation: "Entertainment", documentary: "Entertainment", culture: "Entertainment",
  lifestyle: "Entertainment", cooking: "Entertainment", travel: "Entertainment",
  classic: "Entertainment", relax: "Entertainment", outdoor: "Entertainment",
};
// Higher-priority categories win when a channel lists several.
const PRIORITY: AppCategory[] = ["News", "Sports", "Kids", "Music", "Entertainment"];

// undefined => no canonical data; caller falls back to toAppCategory(groups).
export function canonicalCategory(ids: string[]): AppCategory | undefined {
  if (ids.length === 0) return undefined;
  const mapped = ids.map((id) => CANON[id.toLowerCase()]).filter(Boolean) as AppCategory[];
  for (const cat of PRIORITY) if (mapped.includes(cat)) return cat;
  return "Other"; // has categories, but none are a named bucket
}
