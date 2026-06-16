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
