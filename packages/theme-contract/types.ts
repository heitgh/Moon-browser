export const MOON_THEME_FORMAT = "moon-theme" as const;
export const MOON_THEME_SCHEMA_VERSION = 2 as const;
export type MoonThemeSchemaVersion = 1 | typeof MOON_THEME_SCHEMA_VERSION;

export type MoonThemeTrust = "official" | "local";

export interface MoonThemeFileDescriptor {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mime: string;
}

export interface MoonThemeManifest {
  readonly format: typeof MOON_THEME_FORMAT;
  readonly schemaVersion: MoonThemeSchemaVersion;
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description?: string;
  readonly license: string;
  readonly minMoonVersion: string;
  readonly maxMoonVersion?: string;
  readonly capabilities: readonly ("appearance" | "wallpaper" | "typography" | "icons" | "layout" | "home" | "animation")[];
  readonly assets: readonly MoonThemeFileDescriptor[];
  readonly marketplace: { readonly themeId: string; readonly releaseId: string };
  readonly preview?: { readonly thumbnail?: string; readonly animated: boolean };
}

export interface MoonThemeSignature {
  readonly algorithm: "Ed25519";
  readonly keyId: string;
  readonly publicKey: string;
  readonly signature: string;
}

export interface MoonThemeTokens {
  readonly colors?: Readonly<Partial<Record<"accent" | "background" | "surface" | "surfaceElevated" | "text" | "textMuted" | "border" | "toolbar" | "tabs" | "sidebar" | "home" | "content" | "selection", string>>>;
  readonly typography?: { readonly family?: "system" | "serif" | "mono"; readonly scale?: "compact" | "default" | "large" };
  readonly shape?: { readonly radius?: number; readonly borderWidth?: number; readonly shadow?: number; readonly elevation?: number; readonly spacing?: number; readonly density?: "compact" | "comfortable" };
  readonly glass?: { readonly enabled?: boolean; readonly opacity?: number; readonly blur?: number; readonly intensity?: number };
  readonly wallpaper?: { readonly asset: string; readonly kind?: "image" | "animated"; readonly fit?: "contain" | "cover" | "fill"; readonly position?: string; readonly repeat?: boolean; readonly opacity?: number; readonly blur?: number; readonly brightness?: number; readonly contrast?: number; readonly saturation?: number; readonly hue?: number; readonly dim?: number };
  readonly icons?: Readonly<Partial<Record<"logo" | "newTab" | "privateTab", string>>>;
  readonly layout?: { readonly sidebar?: "left" | "right"; readonly tabStyle?: "compact" | "comfortable" };
  readonly home?: { readonly preset?: "minimal" | "focus" | "study" | "work" | "dev" | "custom"; readonly columns?: 1 | 2 | 3 | 4; readonly gap?: number; readonly maxWidth?: number; readonly horizontalAlign?: "start" | "center" | "end"; readonly verticalAlign?: "start" | "center" | "end"; readonly padding?: number; readonly cardStyle?: "solid" | "transparent" | "glass"; readonly greeting?: string };
  readonly motion?: { readonly enabled?: boolean; readonly speed?: number };
}

export interface ValidatedMoonTheme {
  readonly manifest: MoonThemeManifest;
  readonly tokens: MoonThemeTokens;
  readonly trust: MoonThemeTrust;
  readonly keyId: string;
  readonly entries: ReadonlyMap<string, Uint8Array>;
}

export class MoonThemeValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MoonThemeValidationError";
  }
}
