export type Channel = {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  category: string;
  languages: string[];
  countries: string[];
  nowPlaying?: string;
};

export type EpgProgramme = { title: string; start: string; end: string };

export type EpgEntry = {
  now?: EpgProgramme;
  next?: { title: string; start: string };
};

export type Prefs = {
  languages: string[];
  countries: string[];
};

export type AppCategory =
  | "News" | "Sports" | "Entertainment" | "Music" | "Kids" | "Other";
