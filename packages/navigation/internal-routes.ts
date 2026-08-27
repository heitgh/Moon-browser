export const MOON_SETTINGS_SECTIONS = ["settings", "all", "appearance", "themes", "home", "sidebar", "workspaces", "search", "privacy", "advanced"] as const;
export type MoonSettingsSection = typeof MOON_SETTINGS_SECTIONS[number];

export function normalizeMoonInternalUrl(input: string): string | null {
  if (input === "moon://newtab" || input === "about:blank") return "moon://newtab";
  try {
    const url = new URL(input); if (url.protocol !== "moon:" || url.hostname !== "settings" || url.username || url.password || url.port || url.search || url.hash) return null;
    const section = url.pathname.replace(/^\/+|\/+$/g, "") || "settings";
    return MOON_SETTINGS_SECTIONS.includes(section as MoonSettingsSection) ? `moon://settings/${section}` : null;
  } catch { return null; }
}

export function isMoonSettingsUrl(input: string): boolean { return normalizeMoonInternalUrl(input)?.startsWith("moon://settings/") === true; }

export class MoonInternalHistory {
  readonly #entries: string[] = [];
  #index = -1;

  constructor(initial?: string) { if (initial) this.push(initial); }

  get current(): string | undefined { return this.#entries[this.#index]; }
  get canGoBack(): boolean { return this.#index > 0; }
  get canGoForward(): boolean { return this.#index >= 0 && this.#index < this.#entries.length - 1; }
  get length(): number { return this.#entries.length; }

  push(input: string): string {
    const url = normalizeMoonInternalUrl(input); if (!url) throw new TypeError("Rota interna do Moon inválida.");
    if (this.current === url) return url;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(url);
    this.#index = this.#entries.length - 1;
    return url;
  }

  back(): string | undefined { if (!this.canGoBack) return undefined; this.#index -= 1; return this.current; }
  forward(): string | undefined { if (!this.canGoForward) return undefined; this.#index += 1; return this.current; }
}
