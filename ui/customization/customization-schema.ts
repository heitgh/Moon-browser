export const CUSTOMIZATION_VERSION = 4 as const;
export const CUSTOMIZATION_STORAGE_KEY = "moon:customization:v4";
export const CUSTOMIZATION_LAST_VALID_KEY = "moon:customization:last-valid:v4";
export const CUSTOMIZATION_V3_STORAGE_KEY = "moon:customization:v3";
export const CUSTOMIZATION_V3_LAST_VALID_KEY = "moon:customization:last-valid:v3";
export const CUSTOMIZATION_V2_STORAGE_KEY = "moon:customization:v2";
export const CUSTOMIZATION_V2_LAST_VALID_KEY = "moon:customization:last-valid:v2";

export type ThemeMode = "system" | "light" | "dark" | "scheduled";
export type Density = "compact" | "comfortable" | "touch" | "custom";
export type SidebarPosition = "left" | "right" | "floating" | "collapsed" | "hidden";
export type ToolbarPosition = "top" | "bottom";
export type TabPosition = "top" | "left" | "right";
export type NewTabButtonPosition = "after-tabs" | "end-bar" | "before-tabs" | "toolbar" | "sidebar" | "hidden";
export type OmniboxPosition = "toolbar" | "bottom" | "sidebar";
export type WallpaperType = "local" | "animated" | "https" | "color" | "gradient";
export type SettingsScope = "global" | "workspace";
export type SettingsMode = "simple" | "advanced";
export type SettingsView = "section" | "all";
export type WorkspaceVisibility = "always" | "collapsed" | "hover" | "auto-hide" | "home-only" | "hidden";
export type HomePreset = "minimal" | "focus" | "study" | "work" | "dev" | "custom";
export type HomeWidgetId = "clock" | "date" | "greeting" | "search" | "shortcuts" | "favorites" | "recentTabs" | "sessions" | "tasks" | "notes" | "downloads" | "focus" | "calendar" | "reading" | "performance";
export type ToolbarItemId = "back" | "forward" | "reload" | "home" | "omnibox" | "bookmark" | "downloads" | "modules" | "ai" | "profile" | "menu" | "spacer";
export type SearchEngineId = "duckduckgo" | "google" | "brave" | "bing" | string;

export interface ThemeColors {
  readonly background: string; readonly surface: string; readonly elevated: string;
  readonly text: string; readonly textMuted: string; readonly accent: string;
  readonly border: string; readonly success: string; readonly warning: string; readonly danger: string;
}
export interface ThemeRegions { readonly toolbar: string; readonly tabs: string; readonly sidebar: string; readonly home: string; readonly content: string; readonly selection: string; }

export interface WallpaperSettings {
  readonly type: WallpaperType; readonly source: string; readonly fit: "contain" | "cover" | "fill";
  readonly cachedData?: string;
  readonly position: string; readonly repeat: boolean; readonly opacity: number; readonly blur: number;
  readonly brightness: number; readonly contrast: number; readonly saturation: number; readonly hue: number; readonly dim: number;
}

export interface AppearanceSettings {
  readonly mode: ThemeMode; readonly schedule: { readonly lightAt: string; readonly darkAt: string };
  readonly colors: ThemeColors; readonly wallpaper: WallpaperSettings;
  readonly regions: ThemeRegions;
  readonly glass: { readonly enabled: boolean; readonly intensity: number };
  readonly opacity: { readonly sidebar: number; readonly toolbar: number; readonly cards: number; readonly drawers: number; readonly menus: number; readonly modals: number };
  readonly shape: { readonly radius: number; readonly borderWidth: number; readonly shadow: number; readonly spacing: number; readonly elevation: number };
  readonly motion: { readonly enabled: boolean; readonly speed: number };
}

export interface ToolbarItem { readonly id: ToolbarItemId; readonly visible: boolean; }
export interface LayoutSettings {
  readonly density: Density; readonly uiScale: number;
  readonly tabs: { readonly position: TabPosition; readonly width: number; readonly newTabButton: NewTabButtonPosition };
  readonly sidebar: { readonly position: SidebarPosition; readonly width: number; readonly iconSize: number; readonly spacing: number; readonly labels: "always" | "hover" | "never"; readonly autoHide: boolean; readonly hideDelay: number };
  readonly drawer: { readonly mode: "overlay" | "fixed"; readonly width: number };
  readonly toolbar: { readonly position: ToolbarPosition; readonly height: number; readonly autoHide: boolean; readonly items: readonly ToolbarItem[] };
  readonly omnibox: { readonly position: OmniboxPosition };
  readonly statusBar: { readonly visible: boolean };
}

export interface HomeWidgetSettings { readonly id: HomeWidgetId; readonly visible: boolean; readonly order: number; readonly columns: 1 | 2 | 3 | 4; readonly opacity: number; }
export interface HomeSettings {
  readonly preset: HomePreset; readonly columns: 1 | 2 | 3 | 4; readonly gap: number; readonly maxWidth: number;
  readonly horizontalAlign: "start" | "center" | "end"; readonly verticalAlign: "start" | "center" | "end"; readonly padding: number;
  readonly cardStyle: "solid" | "transparent" | "glass"; readonly greeting: string;
  readonly widgets: readonly HomeWidgetSettings[];
}

export interface TypographySettings {
  readonly family: string; readonly baseSize: number; readonly scale: number; readonly weight: number;
  readonly lineHeight: number; readonly letterSpacing: number;
  readonly uiSize: number; readonly omniboxSize: number; readonly tabSize: number; readonly homeSize: number;
  readonly iconScale: number; readonly labels: boolean;
}

export interface SearchProvider { readonly id: string; readonly name: string; readonly template: string; readonly keyword?: string; }
export interface SearchSettings { readonly defaultEngine: string; readonly providers: readonly SearchProvider[]; }
export interface WorkspaceDisplaySettings { readonly visibility: WorkspaceVisibility; readonly position: "bar" | "sidebar" | "menu"; readonly compactSelector: boolean; }
export interface FaviconSettings { readonly enabled: boolean; readonly persist: boolean; readonly ttlDays: number; }

export interface CustomizationConfig {
  readonly appearance: AppearanceSettings;
  readonly layout: LayoutSettings;
  readonly home: HomeSettings;
  readonly typography: TypographySettings;
  readonly search: SearchSettings;
  readonly workspaceDisplay: WorkspaceDisplaySettings;
  readonly favicons: FaviconSettings;
}

export interface SavedCustomizationTheme { readonly id: string; readonly name: string; readonly createdAt: number; readonly config: CustomizationConfig; }
export interface CustomizationSchemaV4 {
  readonly version: typeof CUSTOMIZATION_VERSION;
  readonly revision: number;
  readonly scope: SettingsScope;
  readonly global: CustomizationConfig;
  readonly workspaces: Readonly<Record<string, CustomizationConfig>>;
  readonly themes: readonly SavedCustomizationTheme[];
  readonly experience: { readonly mode: SettingsMode; readonly view: SettingsView; readonly lastSection: string };
  readonly updatedAt: number;
}
/** Compatibility aliases kept while V3 consumers are migrated incrementally. */
export type CustomizationSchemaV3 = CustomizationSchemaV4;
export type CustomizationSchemaV2 = CustomizationSchemaV4;

const LOCAL_WALLPAPER = "./assets/wallpapers/aurora.svg";
export const WALLPAPER_PRESETS = [
  { name: "Aurora", source: LOCAL_WALLPAPER },
  { name: "Eclipse", source: "./assets/wallpapers/eclipse.svg" },
  { name: "Nebulosa", source: "./assets/wallpapers/nebula.svg" },
  { name: "Horizonte", source: "./assets/wallpapers/horizon.svg" }
] as const;
const BASE_WIDGETS: readonly HomeWidgetSettings[] = [
  ["clock", true, 0, 2], ["date", true, 1, 2], ["greeting", true, 2, 4], ["search", true, 3, 4],
  ["shortcuts", true, 4, 4], ["favorites", false, 5, 2], ["recentTabs", false, 6, 2], ["sessions", false, 7, 2],
  ["tasks", false, 8, 2], ["notes", false, 9, 2], ["downloads", false, 10, 2], ["focus", false, 11, 1],
  ["calendar", false, 12, 2], ["reading", false, 13, 2], ["performance", false, 14, 1]
].map(([id, visible, order, columns]) => ({ id: id as HomeWidgetId, visible: visible as boolean, order: order as number, columns: columns as 1 | 2 | 3 | 4, opacity: 0.92 }));

export const DEFAULT_CUSTOMIZATION: CustomizationConfig = {
  appearance: {
    mode: "dark", schedule: { lightAt: "07:00", darkAt: "19:00" },
    colors: { background: "#0a0c11", surface: "#10131b", elevated: "#171b26", text: "#f1f3f8", textMuted: "#929bad", accent: "#8a5cf5", border: "#2a2f3b", success: "#10b981", warning: "#f59e0b", danger: "#f43f5e" },
    regions: { toolbar: "#10131b", tabs: "#10131b", sidebar: "#0a0c11", home: "#0a0c11", content: "#0a0c11", selection: "#8a5cf5" },
    wallpaper: { type: "local", source: LOCAL_WALLPAPER, fit: "cover", position: "center", repeat: false, opacity: 1, blur: 0, brightness: 1, contrast: 1, saturation: 1, hue: 0, dim: 0.42 },
    glass: { enabled: false, intensity: 22 },
    opacity: { sidebar: 1, toolbar: 1, cards: 0.92, drawers: 1, menus: 1, modals: 1 },
    shape: { radius: 12, borderWidth: 1, shadow: 0.55, spacing: 1, elevation: 1 },
    motion: { enabled: true, speed: 1 }
  },
  layout: {
    density: "comfortable", uiScale: 1,
    tabs: { position: "top", width: 240, newTabButton: "after-tabs" },
    sidebar: { position: "left", width: 56, iconSize: 18, spacing: 8, labels: "hover", autoHide: false, hideDelay: 600 },
    drawer: { mode: "fixed", width: 292 },
    toolbar: { position: "top", height: 48, autoHide: false, items: ([
      ["back", true], ["forward", true], ["reload", true], ["home", false], ["omnibox", true], ["bookmark", true],
      ["downloads", false], ["modules", false], ["spacer", false], ["ai", true], ["profile", false], ["menu", false]
    ] as const).map(([id, visible]) => ({ id, visible })) },
    omnibox: { position: "toolbar" }, statusBar: { visible: true }
  },
  home: { preset: "custom", columns: 4, gap: 16, maxWidth: 900, horizontalAlign: "center", verticalAlign: "center", padding: 32, cardStyle: "transparent", greeting: "Onde você quer chegar hoje?", widgets: BASE_WIDGETS },
  typography: { family: "Inter, ui-sans-serif, system-ui, sans-serif", baseSize: 14, scale: 1, weight: 400, lineHeight: 1.5, letterSpacing: 0, uiSize: 13, omniboxSize: 14, tabSize: 13, homeSize: 16, iconScale: 1, labels: true },
  search: { defaultEngine: "duckduckgo", providers: [
    { id: "duckduckgo", name: "DuckDuckGo", template: "https://duckduckgo.com/?q={query}", keyword: "d" },
    { id: "google", name: "Google", template: "https://www.google.com/search?q={query}", keyword: "g" },
    { id: "brave", name: "Brave Search", template: "https://search.brave.com/search?q={query}", keyword: "b" },
    { id: "bing", name: "Bing", template: "https://www.bing.com/search?q={query}", keyword: "bi" }
  ] },
  workspaceDisplay: { visibility: "always", position: "bar", compactSelector: true },
  favicons: { enabled: true, persist: true, ttlDays: 30 }
};

export function createDefaultCustomization(now = Date.now()): CustomizationSchemaV4 {
  return { version: 4, revision: 0, scope: "global", global: clone(DEFAULT_CUSTOMIZATION), workspaces: {}, themes: [], experience: { mode: "simple", view: "section", lastSection: "appearance" }, updatedAt: now };
}

export function clone<T>(value: T): T { return structuredClone(value); }

export function validateCustomization(value: unknown): CustomizationSchemaV4 {
  const root = object(value, "personalização");
  if (root.version !== 2 && root.version !== 3 && root.version !== 4) throw new Error("Versão de personalização não suportada.");
  const global = config(root.global, "global");
  const workspaceValues = object(root.workspaces, "workspaces");
  const workspaces: Record<string, CustomizationConfig> = {};
  for (const [id, candidate] of Object.entries(workspaceValues)) { text(id, "workspace id", 100); workspaces[id] = config(candidate, `workspace ${id}`); }
  const themes = array(root.themes, "themes", 100).map((candidate, index) => {
    const item = object(candidate, `tema ${index + 1}`);
    return { id: text(item.id, "id do tema", 100), name: text(item.name, "nome do tema", 100), createdAt: integer(item.createdAt, "data do tema", 0, Number.MAX_SAFE_INTEGER), config: config(item.config, `tema ${index + 1}`) };
  });
  if (new Set(themes.map(theme => theme.id)).size !== themes.length) throw new Error("IDs de temas duplicados não são permitidos.");
  const scope = oneOf(root.scope, ["global", "workspace"] as const, "escopo");
  const experienceValue = root.version >= 3 ? object(root.experience, "experiência") : { mode: "essential", lastSection: "appearance" };
  const legacyMode = oneOf(experienceValue.mode, ["simple", "advanced", "essential", "customize", "all"] as const, "modo das configurações");
  const mode: SettingsMode = legacyMode === "essential" ? "simple" : "advanced";
  const inferredView: SettingsView = legacyMode === "customize" || legacyMode === "all" ? "all" : "section";
  const view = legacyMode === "customize" || legacyMode === "all" ? "all" : root.version === 4 && experienceValue.view !== undefined ? oneOf(experienceValue.view, ["section", "all"] as const, "visualização das configurações") : inferredView;
  const experience = { mode, view, lastSection: slug(experienceValue.lastSection, "última seção") };
  return { version: 4, revision: integer(root.revision, "revisão", 0, Number.MAX_SAFE_INTEGER), scope, global, workspaces, themes, experience, updatedAt: integer(root.updatedAt, "data de atualização", 0, Number.MAX_SAFE_INTEGER) };
}

export interface CustomizationRecoveryResult {
  readonly document: CustomizationSchemaV4;
  readonly recoveredSections: readonly string[];
}

export function recoverCustomization(value: unknown, fallback: CustomizationSchemaV4 = createDefaultCustomization()): CustomizationRecoveryResult {
  const base = validateCustomization(fallback); const root = object(value, "personalização");
  if (root.version !== 2 && root.version !== 3 && root.version !== 4) throw new Error("Versão de personalização não suportada.");
  const recoveredSections: string[] = [];
  const recoverConfig = (candidate: unknown, safe: CustomizationConfig, name: string): CustomizationConfig => {
    let source: Record<string, unknown>;
    try { source = object(candidate, name); } catch { recoveredSections.push(name); return clone(safe); }
    let result = clone(safe);
    for (const section of ["appearance", "layout", "home", "typography", "search", "workspaceDisplay", "favicons"] as const) {
      if (source[section] === undefined && root.version === 2 && (section === "workspaceDisplay" || section === "favicons")) continue;
      try { result = config({ ...result, [section]: source[section] }, name); }
      catch { recoveredSections.push(`${name}.${section}`); }
    }
    return result;
  };
  const global = recoverConfig(root.global, base.global, "global");
  const workspaces: Record<string, CustomizationConfig> = clone(base.workspaces);
  try {
    const candidates = object(root.workspaces, "workspaces");
    for (const [id, candidate] of Object.entries(candidates)) {
      try { text(id, "workspace id", 100); workspaces[id] = recoverConfig(candidate, base.workspaces[id] ?? base.global, `workspace ${id}`); }
      catch { recoveredSections.push(`workspace ${id}`); }
    }
  } catch { recoveredSections.push("workspaces"); }
  let themes = base.themes;
  try { themes = validateCustomization({ ...base, themes: root.themes }).themes; } catch { recoveredSections.push("themes"); }
  const recoverTop = <K extends "revision" | "scope" | "updatedAt" | "experience">(key: K): CustomizationSchemaV4[K] => {
    try { return validateCustomization({ ...base, [key]: root[key], global, workspaces, themes })[key]; }
    catch { recoveredSections.push(key); return base[key]; }
  };
  const revision = recoverTop("revision"); const scope = recoverTop("scope"); const updatedAt = recoverTop("updatedAt");
  const experience = root.version === 2 && root.experience === undefined ? base.experience : recoverTop("experience");
  return { document: validateCustomization({ version: 4, revision, scope, global, workspaces, themes, experience, updatedAt }), recoveredSections: [...new Set(recoveredSections)] };
}

function config(value: unknown, name: string): CustomizationConfig {
  const item = object(value, name); const appearanceValue = object(item.appearance, `${name}.appearance`); const colorsValue = object(appearanceValue.colors, `${name}.colors`); const regionsValue = appearanceValue.regions === undefined ? DEFAULT_CUSTOMIZATION.appearance.regions : object(appearanceValue.regions, `${name}.regions`); const wallpaperValue = object(appearanceValue.wallpaper, `${name}.wallpaper`); const opacityValue = object(appearanceValue.opacity, `${name}.opacity`); const shapeValue = object(appearanceValue.shape, `${name}.shape`); const motionValue = object(appearanceValue.motion, `${name}.motion`); const glassValue = object(appearanceValue.glass, `${name}.glass`); const scheduleValue = object(appearanceValue.schedule, `${name}.schedule`);
  const layoutValue = object(item.layout, `${name}.layout`); const tabsValue = layoutValue.tabs === undefined ? DEFAULT_CUSTOMIZATION.layout.tabs : object(layoutValue.tabs, `${name}.tabs`); const sidebarValue = object(layoutValue.sidebar, `${name}.sidebar`); const drawerValue = object(layoutValue.drawer, `${name}.drawer`); const toolbarValue = object(layoutValue.toolbar, `${name}.toolbar`); const omniboxValue = object(layoutValue.omnibox, `${name}.omnibox`); const statusValue = object(layoutValue.statusBar, `${name}.statusBar`);
  const homeValue = object(item.home, `${name}.home`); const typographyValue = object(item.typography, `${name}.typography`); const searchValue = object(item.search, `${name}.search`);
  const workspaceDisplayValue = item.workspaceDisplay === undefined ? DEFAULT_CUSTOMIZATION.workspaceDisplay : object(item.workspaceDisplay, `${name}.workspaceDisplay`); const faviconsValue = item.favicons === undefined ? DEFAULT_CUSTOMIZATION.favicons : object(item.favicons, `${name}.favicons`);
  const wallpaperType = oneOf(wallpaperValue.type, ["local", "animated", "https", "color", "gradient"] as const, "tipo de wallpaper");
  const wallpaperSource = wallpaper(wallpaperType, wallpaperValue.source);
  const widgets = array(homeValue.widgets, "widgets", 30).map((candidate, index) => { const widget = object(candidate, `widget ${index + 1}`); return { id: oneOf(widget.id, HOME_WIDGET_IDS, "widget"), visible: bool(widget.visible, "widget.visible"), order: integer(widget.order, "widget.order", 0, 100), columns: integer(widget.columns, "widget.columns", 1, 4) as 1 | 2 | 3 | 4, opacity: number(widget.opacity, "widget.opacity", 0.2, 1) }; });
  if (new Set(widgets.map(widget => widget.id)).size !== widgets.length) throw new Error("Widgets duplicados não são permitidos.");
  const toolbarItems = array(toolbarValue.items, "toolbar.items", 30).map((candidate, index) => { const toolbarItem = object(candidate, `toolbar item ${index + 1}`); return { id: oneOf(toolbarItem.id, TOOLBAR_ITEM_IDS, "toolbar item"), visible: bool(toolbarItem.visible, "toolbar item.visible") }; });
  if (new Set(toolbarItems.map(entry => entry.id)).size !== toolbarItems.length) throw new Error("Itens duplicados na toolbar.");
  const providers = array(searchValue.providers, "search.providers", 30).map((candidate, index) => { const provider = object(candidate, `buscador ${index + 1}`); const template = urlTemplate(provider.template); return { id: slug(provider.id, "id do buscador"), name: text(provider.name, "nome do buscador", 80), template, ...(provider.keyword === undefined ? {} : { keyword: slug(provider.keyword, "keyword") }) }; });
  if (new Set(providers.map(provider => provider.id)).size !== providers.length) throw new Error("IDs de buscadores duplicados não são permitidos.");
  const keywords = providers.flatMap(provider => provider.keyword ? [provider.keyword] : []); if (new Set(keywords).size !== keywords.length) throw new Error("Keywords de busca duplicadas não são permitidas.");
  if (!providers.some(provider => provider.id === searchValue.defaultEngine)) throw new Error("O buscador padrão não existe na lista de provedores.");
  const colors: ThemeColors = { background: color(colorsValue.background, "background"), surface: color(colorsValue.surface, "surface"), elevated: color(colorsValue.elevated, "elevated"), text: color(colorsValue.text, "text"), textMuted: color(colorsValue.textMuted, "textMuted"), accent: color(colorsValue.accent, "accent"), border: color(colorsValue.border, "border"), success: color(colorsValue.success, "success"), warning: color(colorsValue.warning, "warning"), danger: color(colorsValue.danger, "danger") };
  if (contrast(colors.text, colors.background) < 3) throw new Error("O contraste entre texto e fundo é insuficiente.");
  return {
    appearance: { mode: oneOf(appearanceValue.mode, ["system", "light", "dark", "scheduled"] as const, "modo"), schedule: { lightAt: time(scheduleValue.lightAt), darkAt: time(scheduleValue.darkAt) }, colors, regions: { toolbar: color(regionsValue.toolbar, "regions.toolbar"), tabs: color(regionsValue.tabs, "regions.tabs"), sidebar: color(regionsValue.sidebar, "regions.sidebar"), home: color(regionsValue.home, "regions.home"), content: color(regionsValue.content, "regions.content"), selection: color(regionsValue.selection, "regions.selection") }, wallpaper: { type: wallpaperType, source: wallpaperSource, ...(wallpaperValue.cachedData === undefined ? {} : { cachedData: wallpaperData(wallpaperValue.cachedData) }), fit: oneOf(wallpaperValue.fit, ["contain", "cover", "fill"] as const, "ajuste"), position: text(wallpaperValue.position, "posição", 40), repeat: bool(wallpaperValue.repeat, "repeat"), opacity: number(wallpaperValue.opacity, "opacity", 0, 1), blur: number(wallpaperValue.blur, "blur", 0, 40), brightness: number(wallpaperValue.brightness, "brightness", 0.2, 2), contrast: number(wallpaperValue.contrast, "contrast", 0.2, 2), saturation: number(wallpaperValue.saturation, "saturation", 0, 2), hue: number(wallpaperValue.hue, "hue", -180, 180), dim: number(wallpaperValue.dim, "dim", 0, 0.9) }, glass: { enabled: bool(glassValue.enabled, "glass.enabled"), intensity: number(glassValue.intensity, "glass.intensity", 0, 40) }, opacity: { sidebar: number(opacityValue.sidebar, "sidebar opacity", 0.2, 1), toolbar: number(opacityValue.toolbar, "toolbar opacity", 0.2, 1), cards: number(opacityValue.cards, "cards opacity", 0.2, 1), drawers: number(opacityValue.drawers, "drawers opacity", 0.2, 1), menus: number(opacityValue.menus, "menus opacity", 0.2, 1), modals: number(opacityValue.modals, "modals opacity", 0.2, 1) }, shape: { radius: number(shapeValue.radius, "radius", 0, 32), borderWidth: number(shapeValue.borderWidth, "borderWidth", 0, 4), shadow: number(shapeValue.shadow, "shadow", 0, 1), spacing: number(shapeValue.spacing, "spacing", 0.75, 1.5), elevation: number(shapeValue.elevation, "elevation", 0, 2) }, motion: { enabled: bool(motionValue.enabled, "motion.enabled"), speed: number(motionValue.speed, "motion.speed", 0.25, 2) } },
    layout: { density: oneOf(layoutValue.density, ["compact", "comfortable", "touch", "custom"] as const, "density"), uiScale: number(layoutValue.uiScale, "uiScale", 0.8, 1.3), tabs: { position: oneOf(tabsValue.position, ["top", "left", "right"] as const, "tabs.position"), width: number(tabsValue.width, "tabs.width", 180, 360), newTabButton: tabsValue.newTabButton === undefined ? "after-tabs" : oneOf(tabsValue.newTabButton, ["after-tabs", "end-bar", "before-tabs", "toolbar", "sidebar", "hidden"] as const, "tabs.newTabButton") }, sidebar: { position: oneOf(sidebarValue.position, ["left", "right", "floating", "collapsed", "hidden"] as const, "sidebar.position"), width: number(sidebarValue.width, "sidebar.width", 44, 240), iconSize: number(sidebarValue.iconSize, "sidebar.iconSize", 14, 28), spacing: number(sidebarValue.spacing, "sidebar.spacing", 2, 18), labels: oneOf(sidebarValue.labels, ["always", "hover", "never"] as const, "sidebar.labels"), autoHide: sidebarValue.autoHide === undefined ? false : bool(sidebarValue.autoHide, "sidebar.autoHide"), hideDelay: sidebarValue.hideDelay === undefined ? 600 : integer(sidebarValue.hideDelay, "sidebar.hideDelay", 100, 5000) }, drawer: { mode: oneOf(drawerValue.mode, ["overlay", "fixed"] as const, "drawer.mode"), width: number(drawerValue.width, "drawer.width", 220, 560) }, toolbar: { position: oneOf(toolbarValue.position, ["top", "bottom"] as const, "toolbar.position"), height: number(toolbarValue.height, "toolbar.height", 40, 76), autoHide: bool(toolbarValue.autoHide, "toolbar.autoHide"), items: toolbarItems }, omnibox: { position: oneOf(omniboxValue.position, ["toolbar", "bottom", "sidebar"] as const, "omnibox.position") }, statusBar: { visible: bool(statusValue.visible, "statusBar.visible") } },
    home: { preset: oneOf(homeValue.preset, ["minimal", "focus", "study", "work", "dev", "custom"] as const, "home.preset"), columns: integer(homeValue.columns, "home.columns", 1, 4) as 1 | 2 | 3 | 4, gap: number(homeValue.gap, "home.gap", 0, 48), maxWidth: number(homeValue.maxWidth, "home.maxWidth", 480, 1600), horizontalAlign: oneOf(homeValue.horizontalAlign, ["start", "center", "end"] as const, "home.horizontalAlign"), verticalAlign: oneOf(homeValue.verticalAlign, ["start", "center", "end"] as const, "home.verticalAlign"), padding: number(homeValue.padding, "home.padding", 0, 96), cardStyle: oneOf(homeValue.cardStyle, ["solid", "transparent", "glass"] as const, "home.cardStyle"), greeting: text(homeValue.greeting, "saudação", 160), widgets },
    typography: { family: font(typographyValue.family), baseSize: number(typographyValue.baseSize, "baseSize", 11, 22), scale: number(typographyValue.scale, "font scale", 0.8, 1.4), weight: integer(typographyValue.weight, "font weight", 300, 800), lineHeight: number(typographyValue.lineHeight, "lineHeight", 1.1, 2), letterSpacing: number(typographyValue.letterSpacing, "letterSpacing", -0.05, 0.15), uiSize: number(typographyValue.uiSize, "uiSize", 9, 20), omniboxSize: number(typographyValue.omniboxSize, "omniboxSize", 10, 22), tabSize: number(typographyValue.tabSize, "tabSize", 9, 18), homeSize: number(typographyValue.homeSize, "homeSize", 12, 28), iconScale: number(typographyValue.iconScale, "iconScale", 0.75, 1.5), labels: bool(typographyValue.labels, "labels") },
    search: { defaultEngine: slug(searchValue.defaultEngine, "buscador padrão"), providers },
    workspaceDisplay: { visibility: oneOf(workspaceDisplayValue.visibility, ["always", "collapsed", "hover", "auto-hide", "home-only", "hidden"] as const, "visibilidade das workspaces"), position: oneOf(workspaceDisplayValue.position, ["bar", "sidebar", "menu"] as const, "posição das workspaces"), compactSelector: bool(workspaceDisplayValue.compactSelector, "seletor compacto") },
    favicons: { enabled: bool(faviconsValue.enabled, "favicons.enabled"), persist: bool(faviconsValue.persist, "favicons.persist"), ttlDays: integer(faviconsValue.ttlDays, "favicons.ttlDays", 1, 365) }
  };
}

export function migrateLegacyCustomization(storage: Pick<Storage, "getItem">, now = Date.now()): CustomizationSchemaV4 {
  const next = createDefaultCustomization(now); let legacy: Record<string, unknown> = {};
  try { const raw = storage.getItem("moon:preferences:v1"); if (raw) legacy = object(JSON.parse(raw), "preferências antigas"); } catch { legacy = {}; }
  const global = clone(next.global);
  if (typeof legacy.accent === "string" && /^#[0-9a-f]{6}$/i.test(legacy.accent)) (global.appearance.colors as { accent: string }).accent = legacy.accent.toLowerCase();
  if (typeof legacy.wallpaper === "string" && /^\.\/assets\/wallpapers\/[a-z0-9-]+\.svg$/.test(legacy.wallpaper)) (global.appearance.wallpaper as { source: string }).source = legacy.wallpaper;
  if (legacy.glassHome === true) { (global.home as { cardStyle: HomeSettings["cardStyle"] }).cardStyle = "glass"; (global.appearance.glass as { enabled: boolean }).enabled = true; }
  if (legacy.showClock === false) for (const widget of global.home.widgets) if (widget.id === "clock" || widget.id === "date") (widget as { visible: boolean }).visible = false;
  if (legacy.showShortcuts === false) for (const widget of global.home.widgets) if (widget.id === "shortcuts") (widget as { visible: boolean }).visible = false;
  if (typeof legacy.searchEngine === "string" && global.search.providers.some(provider => provider.id === legacy.searchEngine)) (global.search as { defaultEngine: string }).defaultEngine = legacy.searchEngine;
  return validateCustomization({ ...next, global });
}

export function resolveCustomization(document: CustomizationSchemaV4, workspaceId?: string): CustomizationConfig {
  return document.scope === "workspace" && workspaceId && document.workspaces[workspaceId] ? document.workspaces[workspaceId] : document.global;
}

export function serializeCustomization(document: CustomizationSchemaV4, scope: "all" | "appearance" | "workspace" = "all", workspaceId?: string): string {
  const payload = scope === "appearance" ? { format: "moon-customization", version: 4, scope, appearance: resolveCustomization(document, workspaceId).appearance } : scope === "workspace" ? { format: "moon-customization", version: 4, scope, workspaceId, config: resolveCustomization(document, workspaceId) } : { format: "moon-customization", version: 4, scope, document };
  return JSON.stringify(payload, null, 2);
}

export function parseCustomizationImport(content: string, current: CustomizationSchemaV4, workspaceId?: string): CustomizationSchemaV4 {
  if (content.length > 2_000_000) throw new Error("O arquivo de personalização excede 2 MB.");
  let parsed: unknown; try { parsed = JSON.parse(content); } catch { throw new Error("O arquivo não contém JSON válido."); }
  const payload = object(parsed, "arquivo"); if (payload.format !== "moon-customization" || (payload.version !== 2 && payload.version !== 3 && payload.version !== 4)) throw new Error("Formato de personalização não suportado.");
  if (payload.scope === "all") return validateCustomization(payload.document);
  const next = clone(current);
  if (payload.scope === "appearance") { const candidate = config({ ...resolveCustomization(current, workspaceId), appearance: payload.appearance }, "importação"); setResolved(next, workspaceId, candidate); }
  else if (payload.scope === "workspace") setResolved(next, workspaceId, config(payload.config, "workspace importado"));
  else throw new Error("Escopo de importação inválido.");
  return validateCustomization({ ...next, revision: next.revision + 1, updatedAt: Date.now() });
}

export function setResolved(document: CustomizationSchemaV4, workspaceId: string | undefined, configValue: CustomizationConfig): void {
  if (document.scope === "workspace" && workspaceId) (document.workspaces as Record<string, CustomizationConfig>)[workspaceId] = configValue;
  else (document as { global: CustomizationConfig }).global = configValue;
}

export function contrast(foreground: string, background: string): number { const luminance = (hex: string): number => { const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4); return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!; }; const a = luminance(foreground); const b = luminance(background); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

const HOME_WIDGET_IDS = ["clock", "date", "greeting", "search", "shortcuts", "favorites", "recentTabs", "sessions", "tasks", "notes", "downloads", "focus", "calendar", "reading", "performance"] as const;
const TOOLBAR_ITEM_IDS = ["back", "forward", "reload", "home", "omnibox", "bookmark", "downloads", "modules", "ai", "profile", "menu", "spacer"] as const;
function object(value: unknown, name: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} deve ser um objeto.`); return value as Record<string, unknown>; }
function array(value: unknown, name: string, max: number): readonly unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error(`${name} deve ser uma lista válida.`); return value; }
function text(value: unknown, name: string, max: number): string { if (typeof value !== "string" || value.length > max || value.includes("\0")) throw new Error(`${name} é inválido.`); return value; }
function bool(value: unknown, name: string): boolean { if (typeof value !== "boolean") throw new Error(`${name} deve ser verdadeiro ou falso.`); return value; }
function number(value: unknown, name: string, min: number, max: number): number { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} deve ficar entre ${min} e ${max}.`); return value; }
function integer(value: unknown, name: string, min: number, max: number): number { const result = number(value, name, min, max); if (!Number.isInteger(result)) throw new Error(`${name} deve ser inteiro.`); return result; }
function oneOf<const T extends readonly string[]>(value: unknown, values: T, name: string): T[number] { if (typeof value !== "string" || !values.includes(value)) throw new Error(`${name} é inválido.`); return value as T[number]; }
function color(value: unknown, name: string): string { const result = text(value, name, 32).toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(result)) throw new Error(`${name} deve usar HEX com seis dígitos.`); return result; }
function time(value: unknown): string { const result = text(value, "horário", 5); if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result)) throw new Error("Horário inválido."); return result; }
function slug(value: unknown, name: string): string { const result = text(value, name, 40); if (!/^[a-z0-9][a-z0-9-]*$/i.test(result)) throw new Error(`${name} só pode conter letras, números e hífen.`); return result; }
function font(value: unknown): string { const result = text(value, "fonte", 180); if (/[;{}<>]/.test(result)) throw new Error("A família tipográfica contém caracteres inválidos."); return result; }
function wallpaper(type: WallpaperType, value: unknown): string { const result = text(value, "wallpaper", 2_000_000); if (type === "local" && !/^\.\/assets\/wallpapers\/[a-z0-9-]+\.svg$/.test(result) && !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(result)) throw new Error("Wallpaper local inválido."); if (type === "animated" && !/^data:image\/gif;base64,[a-z0-9+/=]+$/i.test(result)) throw new Error("Wallpaper animado inválido."); if (type === "https") { let parsed: URL; try { parsed = new URL(result); } catch { throw new Error("URL do wallpaper inválida."); } if (parsed.protocol !== "https:") throw new Error("Wallpaper remoto precisa usar HTTPS."); } if (type === "color") return color(result, "cor do wallpaper"); if (type === "gradient" && (!/^(linear|radial)-gradient\(/.test(result) || /url\s*\(/i.test(result) || result.length > 500)) throw new Error("Gradiente inválido."); return result; }
function urlTemplate(value: unknown): string { const result = text(value, "template de busca", 1000); if (!result.includes("{query}")) throw new Error("O template precisa conter {query}."); let parsed: URL; try { parsed = new URL(result.replace("{query}", "moon")); } catch { throw new Error("Template de busca inválido."); } if (parsed.protocol !== "https:") throw new Error("O buscador precisa usar HTTPS."); return result; }
function wallpaperData(value: unknown): string { const result = text(value, "cache do wallpaper", 2_000_000); if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(result)) throw new Error("Cache do wallpaper inválido."); return result; }
