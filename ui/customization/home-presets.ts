import type { HomePreset, HomeSettings, HomeWidgetId } from "./customization-schema.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
interface PresetComposition {
  readonly visible: readonly HomeWidgetId[];
  readonly columns: 1 | 2 | 3 | 4;
  readonly gap: number;
  readonly maxWidth: number;
  readonly horizontalAlign: HomeSettings["horizontalAlign"];
  readonly verticalAlign: HomeSettings["verticalAlign"];
  readonly padding: number;
  readonly cardStyle: HomeSettings["cardStyle"];
  readonly greeting: string;
  readonly spans: Partial<Readonly<Record<HomeWidgetId, 1 | 2 | 3 | 4>>>;
}

export const HOME_PRESET_COMPOSITIONS: Readonly<Record<Exclude<HomePreset, "custom">, PresetComposition>> = {
  minimal: { visible: ["clock", "date", "search", "shortcuts"], columns: 4, gap: 10, maxWidth: 760, horizontalAlign: "center", verticalAlign: "center", padding: 28, cardStyle: "transparent", greeting: "", spans: { clock: 2, date: 2, search: 4, shortcuts: 4 } },
  focus: { visible: ["clock", "greeting", "search", "focus", "notes"], columns: 3, gap: 18, maxWidth: 860, horizontalAlign: "center", verticalAlign: "center", padding: 38, cardStyle: "glass", greeting: "Uma coisa de cada vez.", spans: { clock: 1, greeting: 2, search: 3, focus: 1, notes: 2 } },
  study: { visible: ["clock", "date", "search", "shortcuts", "tasks", "reading", "notes"], columns: 4, gap: 14, maxWidth: 1120, horizontalAlign: "center", verticalAlign: "start", padding: 30, cardStyle: "solid", greeting: "O que vamos aprender hoje?", spans: { clock: 1, date: 1, search: 2, shortcuts: 4, tasks: 2, reading: 2, notes: 4 } },
  work: { visible: ["clock", "date", "search", "favorites", "recentTabs", "tasks", "calendar", "downloads"], columns: 4, gap: 12, maxWidth: 1240, horizontalAlign: "center", verticalAlign: "start", padding: 26, cardStyle: "solid", greeting: "Organize, decida, avance.", spans: { clock: 1, date: 1, search: 2, favorites: 2, recentTabs: 2, tasks: 2, calendar: 2, downloads: 4 } },
  dev: { visible: ["clock", "search", "shortcuts", "recentTabs", "sessions", "notes", "performance"], columns: 4, gap: 8, maxWidth: 1360, horizontalAlign: "center", verticalAlign: "start", padding: 22, cardStyle: "transparent", greeting: "Build. Measure. Refine.", spans: { clock: 1, search: 3, shortcuts: 4, recentTabs: 2, sessions: 2, notes: 3, performance: 1 } }
};

export function applyHomePreset(home: HomeSettings, preset: Exclude<HomePreset, "custom">): void {
  const composition = HOME_PRESET_COMPOSITIONS[preset]; const mutable = home as Mutable<HomeSettings>;
  mutable.preset = preset; mutable.columns = composition.columns; mutable.gap = composition.gap; mutable.maxWidth = composition.maxWidth; mutable.horizontalAlign = composition.horizontalAlign; mutable.verticalAlign = composition.verticalAlign; mutable.padding = composition.padding; mutable.cardStyle = composition.cardStyle; mutable.greeting = composition.greeting;
  home.widgets.forEach(widget => { const next = widget as Mutable<typeof widget>; next.visible = composition.visible.includes(widget.id); next.columns = Math.min(composition.columns, composition.spans[widget.id] ?? widget.columns) as 1 | 2 | 3 | 4; });
}
