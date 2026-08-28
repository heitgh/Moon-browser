import { clone, validateCustomization, type CustomizationConfig, type LayoutSettings, type SavedCustomizationTheme, type SettingsScope } from "./customization-schema.js";

export const CUSTOMIZATION_V3_VERSION = 3 as const;
export const CUSTOMIZATION_V3_STORAGE_KEY = "moon:customization:v3";
export const CUSTOMIZATION_V3_LAST_VALID_KEY = "moon:customization:last-valid:v3";

export type SettingsMode = "essential" | "customize" | "advanced";
export type WorkspaceVisibility = "always" | "collapsed" | "hover" | "auto-hide" | "home-only" | "hidden";

export type V3SidebarSettings = LayoutSettings["sidebar"] & { readonly autoHide: boolean; readonly hideDelay: number };

export interface CustomizationConfigV3 extends Omit<CustomizationConfig, "layout"> {
  readonly layout: Omit<LayoutSettings, "sidebar"> & { readonly sidebar: V3SidebarSettings };
  readonly workspaceDisplay: { readonly visibility: WorkspaceVisibility; readonly position: "bar" | "sidebar" | "menu"; readonly compactSelector: boolean };
  readonly favicons: { readonly enabled: boolean; readonly persist: boolean; readonly ttlDays: number };
}

export interface SavedCustomizationThemeV3 extends Omit<SavedCustomizationTheme, "config"> { readonly config: CustomizationConfigV3; }

export interface CustomizationSchemaV3 {
  readonly version: typeof CUSTOMIZATION_V3_VERSION;
  readonly revision: number;
  readonly scope: SettingsScope;
  readonly global: CustomizationConfigV3;
  readonly workspaces: Readonly<Record<string, CustomizationConfigV3>>;
  readonly themes: readonly SavedCustomizationThemeV3[];
  readonly experience: { readonly mode: SettingsMode; readonly lastSection: string };
  readonly updatedAt: number;
}

export function migrateCustomizationV2ToV3(input: unknown): CustomizationSchemaV3 {
  const source = validateCustomization(input);
  const workspaces = Object.fromEntries(Object.entries(source.workspaces).map(([id, config]) => [id, enrich(config)]));
  return {
    version: 3,
    revision: source.revision,
    scope: source.scope,
    global: enrich(source.global),
    workspaces,
    themes: source.themes.map(theme => ({ ...theme, config: enrich(theme.config) })),
    experience: { mode: "essential", lastSection: "appearance" },
    updatedAt: source.updatedAt
  };
}

function enrich(config: CustomizationConfig): CustomizationConfigV3 {
  const value = clone(config);
  return {
    ...value,
    layout: { ...value.layout, sidebar: { ...value.layout.sidebar, autoHide: false, hideDelay: 600 } },
    workspaceDisplay: { visibility: "always", position: "bar", compactSelector: true },
    favicons: { enabled: true, persist: true, ttlDays: 30 }
  };
}
