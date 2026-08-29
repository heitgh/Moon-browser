import { IconRegistry } from "./icon-registry.js";

const ICONS = {
  moon: '<path d="M20.7 13.1A8.5 8.5 0 0 1 10.9 3.3 9 9 0 1 0 20.7 13.1Z"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1Z"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  back: '<path d="m15 18-6-6 6-6"/>', forward: '<path d="m9 18 6-6-6-6"/>',
  reload: '<path d="M20 6v5h-5"/><path d="M19 15a8 8 0 1 1-1.9-8.2L20 11"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H13a2 2 0 0 1 0-4h2a6 6 0 0 0 0-11Z"/><circle cx="8" cy="10" r=".6"/><circle cx="10" cy="7" r=".6"/><circle cx="14" cy="7" r=".6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  note: '<path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  translate: '<path d="M4 5h9M8.5 3v2M6 8c1 3 3 5 6 6M12 8c-1 3-3 5-6 6"/><path d="m14 21 4-10 4 10M15.5 17h5"/>',
  plugin: '<path d="M8 3h3a2 2 0 1 0 4 0h3v5a2 2 0 1 1 0 4v5h-5a2 2 0 1 1-4 0H4v-5a2 2 0 1 0 0-4V3Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="m8 5 11 7-11 7Z"/>', folder: '<path d="M3 6h7l2 2h9v11H3Z"/>'
} as const;

export type IconName = keyof typeof ICONS;
const ICON_REGISTRY = new IconRegistry<IconName>(ICONS);

export const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const icon = (name: IconName, className = "moon-icon"): SVGSVGElement => {
  return ICON_REGISTRY.create(name, className);
};

export function installIconOverrides(overrides: Readonly<Partial<Record<IconName, string>>>): void { ICON_REGISTRY.install(overrides); }
export function clearIconOverrides(names?: readonly IconName[]): void { ICON_REGISTRY.clear(names); }

export const button = (className: string, label: string, name?: IconName): HTMLButtonElement => {
  const node = element("button", className);
  node.type = "button";
  node.title = label;
  node.setAttribute("aria-label", label);
  if (name) node.append(icon(name));
  return node;
};
