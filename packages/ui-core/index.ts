export type MoonThemeMode = "light" | "dark" | "system";
export interface MoonDesignTokens { readonly colors: Readonly<Record<string, string>>; readonly spacing: Readonly<Record<string, string>>; readonly typography: Readonly<Record<string, string>>; readonly radii: Readonly<Record<string, string>>; readonly motion: Readonly<Record<string, string>>; }
export interface UiDisposable { dispose(): void; }
export function applyDesignTokens(target: HTMLElement, tokens: MoonDesignTokens): void { const groups = Object.entries(tokens) as [string, Readonly<Record<string,string>>][]; for (const [group, values] of groups) for (const [name, value] of Object.entries(values)) target.style.setProperty(`--moon-${group}-${name}`, value); }
