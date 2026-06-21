export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrls: string[];
  category: string;
  languages: string[];
  countries: string[];
  quality?: string | null;
};

export type Prefs = {
  languages: string[];
  countries: string[];
};

export type AppCategory =
  | "News" | "Sports" | "Entertainment" | "Music" | "Kids" | "Other";
