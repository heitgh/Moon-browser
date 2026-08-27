import type { Preferences, SearchEngine, Workspace } from "./contracts.js";

export const PROFILE_KEYS = {
  bookmarks: "moon:bookmarks:v1",
  history: "moon:history:v1",
  preferences: "moon:preferences:v1",
  workspaces: "moon:workspaces:v1",
  notes: "moon:notes:v1",
  shortcuts: "moon:shortcuts:v1",
  themes: "moon:themes:v1",
  adblock: "moon:adblock-enabled:v1",
  migration: "moon:sqlite-migration:v1"
} as const;

export const DEFAULT_WORKSPACES: readonly Workspace[] = [
  { id: "research", name: "Pesquisa" },
  { id: "study", name: "Estudos" },
  { id: "projects", name: "Projetos" }
];

export const DEFAULT_PREFERENCES: Preferences = {
  accent: "#8a5cf5",
  wallpaper: "./assets/wallpapers/aurora.svg",
  searchEngine: "duckduckgo",
  showClock: true,
  showShortcuts: true,
  glassHome: false
};

export const WALLPAPERS = [
  DEFAULT_PREFERENCES.wallpaper,
  "./assets/wallpapers/eclipse.svg",
  "./assets/wallpapers/nebula.svg",
  "./assets/wallpapers/horizon.svg"
] as const;

export function normalizePreferences(value: Partial<Preferences>): Preferences {
  const candidate = { ...DEFAULT_PREFERENCES, ...value };
  return {
    ...candidate,
    wallpaper: WALLPAPERS.includes(candidate.wallpaper as typeof WALLPAPERS[number])
      ? candidate.wallpaper
      : DEFAULT_PREFERENCES.wallpaper
  };
}

export const ACCENTS = ["#8a5cf5", "#38bdf8", "#10b981", "#f43f5e", "#f59e0b"] as const;
export const SEARCH_ENGINES: Readonly<Record<SearchEngine, string>> = {
  duckduckgo: "https://duckduckgo.com/?q=",
  google: "https://www.google.com/search?q=",
  brave: "https://search.brave.com/search?q="
};

export function loadProfileValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function saveProfileValue(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Moon persistence failed", error);
  }
}
