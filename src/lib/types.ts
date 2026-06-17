export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  category: string;
  languages: string[];
  countries: string[];
};

export type Prefs = {
  languages: string[];
  countries: string[];
};

export type AppCategory =
  | "News" | "Sports" | "Entertainment" | "Music" | "Kids" | "Other";
