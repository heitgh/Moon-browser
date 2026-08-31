import type { MoonThemeSummary } from "../browser-shell/contracts.js";
import type { CustomizationConfig, SavedCustomizationTheme, ThemeIncludeArea } from "./customization-schema.js";

export type ThemeCatalogSource = "builtin" | "user" | "moontheme";
export type ThemeCatalogTrust = "builtin" | "official" | "local";

export interface ThemeCatalogEntry {
  readonly id: string;
  readonly source: ThemeCatalogSource;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly trust: ThemeCatalogTrust;
  readonly active: boolean;
  readonly installedAt: number;
  readonly modifiedAt: number;
  readonly description?: string;
  readonly favorite: boolean;
  readonly useCount: number;
  readonly includes: readonly ThemeIncludeArea[];
  readonly config?: CustomizationConfig;
  readonly packageId?: string;
  readonly capabilities: readonly ("appearance" | "wallpaper" | "typography" | "icons" | "layout" | "home" | "animation")[];
}

const BUILTIN_THEMES: readonly ThemeCatalogEntry[] = [{
  id: "builtin:moon-aurora",
  source: "builtin",
  name: "Moon Aurora",
  version: "4.0.0",
  author: "Moon Browser",
  trust: "builtin",
  active: false,
  installedAt: 0,
  modifiedAt: 0,
  favorite: false,
  useCount: 0,
  includes: ["colors", "wallpaper", "effects", "typography", "icons", "layout", "home"],
  capabilities: ["appearance", "wallpaper", "typography", "layout", "home"]
}];

export function buildThemeCatalog(
  userThemes: readonly SavedCustomizationTheme[],
  moonThemes: readonly MoonThemeSummary[],
  selectedId?: string
): readonly ThemeCatalogEntry[] {
  const builtins = BUILTIN_THEMES.map(theme => ({ ...theme, active: selectedId === theme.id }));
  const users: ThemeCatalogEntry[] = userThemes.map(theme => ({
    id: theme.id,
    source: "user",
    name: theme.name,
    version: `v${theme.version}`,
    author: "Você",
    trust: "local",
    active: selectedId === theme.id,
    installedAt: theme.createdAt,
    modifiedAt: theme.updatedAt,
    ...(theme.description ? { description: theme.description } : {}),
    favorite: theme.favorite,
    useCount: theme.useCount,
    includes: theme.includes,
    config: theme.config,
    capabilities: ["appearance", "wallpaper", "typography", ...(Object.keys(theme.config.icons.overrides).length ? ["icons" as const] : []), "layout", "home"]
  }));
  const packages: ThemeCatalogEntry[] = moonThemes.map(theme => ({
    id: theme.id,
    source: "moontheme",
    name: theme.name,
    version: theme.version,
    author: theme.author,
    trust: theme.trust,
    active: selectedId ? selectedId === theme.id : theme.active,
    installedAt: theme.installedAt,
    modifiedAt: theme.installedAt,
    favorite: false,
    useCount: 0,
    includes: ["colors", "wallpaper", "effects", "typography", "icons", "layout"],
    packageId: theme.packageId,
    capabilities: ["appearance", "wallpaper", "typography", "icons", "layout"]
  }));
  return [...builtins, ...users, ...packages].sort((left, right) => Number(right.active) - Number(left.active) || sourceOrder(left.source) - sourceOrder(right.source) || right.installedAt - left.installedAt || left.name.localeCompare(right.name));
}

function sourceOrder(source: ThemeCatalogSource): number {
  return source === "builtin" ? 0 : source === "user" ? 1 : 2;
}
