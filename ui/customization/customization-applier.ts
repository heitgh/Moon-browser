import type { CustomizationConfig, ThemeMode } from "./customization-schema.js";

export class CustomizationApplier {
  #media: MediaQueryList | undefined;
  #listener: (() => void) | undefined;
  #config: CustomizationConfig | undefined;

  constructor(readonly root: HTMLElement = document.documentElement) {}

  apply(config: CustomizationConfig): void {
    this.#config = config;
    const { appearance, layout, typography, home } = config;
    const resolvedMode = this.#resolveMode(appearance.mode, appearance.schedule.lightAt, appearance.schedule.darkAt);
    const colors = resolvedMode === "light" ? {
      ...appearance.colors,
      background: mix(appearance.colors.background, "#ffffff", .9), surface: mix(appearance.colors.surface, "#ffffff", .92), elevated: mix(appearance.colors.elevated, "#ffffff", .86),
      text: mix(appearance.colors.text, "#000000", .88), textMuted: mix(appearance.colors.textMuted, "#000000", .62), border: mix(appearance.colors.border, "#000000", .14)
    } : appearance.colors;
    this.root.dataset.moonTheme = resolvedMode;
    this.root.dataset.moonThemeMode = appearance.mode;
    this.root.dataset.moonDensity = layout.density;
    this.root.dataset.moonSidebar = layout.sidebar.position;
    this.root.dataset.moonDrawer = layout.drawer.mode;
    this.root.dataset.moonToolbar = layout.toolbar.position;
    this.root.dataset.moonTabs = layout.tabs.position;
    this.root.dataset.moonOmnibox = layout.omnibox.position;
    this.root.dataset.moonMotion = appearance.motion.enabled ? "on" : "off";
    this.root.dataset.moonGlass = appearance.glass.enabled ? "on" : "off";
    this.root.dataset.moonHomeCards = home.cardStyle;
    this.root.dataset.moonHomeHorizontal = home.horizontalAlign;
    this.root.dataset.moonHomeVertical = home.verticalAlign;
    this.root.dataset.moonStatus = layout.statusBar.visible ? "visible" : "hidden";
    this.root.dataset.moonSidebarLabels = layout.sidebar.labels;
    this.root.dataset.moonSidebarAutoHide = layout.sidebar.autoHide ? "on" : "off";
    this.root.dataset.moonWorkspaces = config.workspaceDisplay.visibility;
    this.root.dataset.moonWorkspaceSelector = config.workspaceDisplay.compactSelector ? "compact" : "full";
    this.root.style.colorScheme = resolvedMode;
    const variables: Readonly<Record<string, string>> = {
      "--moon-user-accent": colors.accent, "--moon-user-accent-soft": `${colors.accent}32`,
      "--moon-bg": colors.background, "--moon-surface": colors.surface, "--moon-surface-raised": colors.elevated,
      "--moon-text": colors.text, "--moon-text-muted": colors.textMuted, "--moon-border": colors.border,
      "--moon-success": colors.success, "--moon-warning": colors.warning, "--moon-danger": colors.danger,
      "--moon-region-toolbar": appearance.regions.toolbar, "--moon-region-tabs": appearance.regions.tabs, "--moon-region-sidebar": appearance.regions.sidebar,
      "--moon-region-home": appearance.regions.home, "--moon-region-content": appearance.regions.content, "--moon-region-selection": appearance.regions.selection,
      "--moon-sidebar-width": `${layout.sidebar.width}px`, "--moon-sidebar-icon": `${layout.sidebar.iconSize}px`, "--moon-sidebar-gap": `${layout.sidebar.spacing}px`,
      "--moon-sidebar-hide-delay": `${layout.sidebar.hideDelay}ms`,
      "--moon-drawer-width": `${layout.drawer.width}px`, "--moon-tabs-width": `${layout.tabs.width}px`, "--moon-toolbar-height": `${layout.toolbar.height}px`, "--moon-ui-scale": String(layout.uiScale),
      "--moon-sidebar-opacity": String(appearance.opacity.sidebar), "--moon-toolbar-opacity": String(appearance.opacity.toolbar), "--moon-card-opacity": String(appearance.opacity.cards),
      "--moon-drawer-opacity": String(appearance.opacity.drawers), "--moon-menu-opacity": String(appearance.opacity.menus), "--moon-modal-opacity": String(appearance.opacity.modals),
      "--moon-radius": `${appearance.shape.radius}px`, "--moon-border-width": `${appearance.shape.borderWidth}px`, "--moon-shadow-strength": String(appearance.shape.shadow),
      "--moon-spacing-scale": String(appearance.shape.spacing), "--moon-elevation": String(appearance.shape.elevation), "--moon-glass-blur": `${appearance.glass.intensity}px`,
      "--moon-motion-speed": String(appearance.motion.speed), "--moon-font-family": typography.family, "--moon-font-base": `${typography.baseSize}px`, "--moon-font-scale": String(typography.scale),
      "--moon-font-weight": String(typography.weight), "--moon-line-height": String(typography.lineHeight), "--moon-letter-spacing": `${typography.letterSpacing}em`,
      "--moon-ui-font-size": `${typography.uiSize}px`, "--moon-omnibox-font-size": `${typography.omniboxSize}px`, "--moon-tab-font-size": `${typography.tabSize}px`, "--moon-home-font-size": `${typography.homeSize}px`, "--moon-icon-scale": String(typography.iconScale),
      "--moon-home-columns": String(home.columns), "--moon-home-gap": `${home.gap}px`, "--moon-home-max-width": `${home.maxWidth}px`, "--moon-home-padding": `${home.padding}px`,
      "--moon-wallpaper-opacity": String(appearance.wallpaper.opacity), "--moon-wallpaper-blur": `${appearance.wallpaper.blur}px`, "--moon-wallpaper-brightness": String(appearance.wallpaper.brightness), "--moon-wallpaper-contrast": String(appearance.wallpaper.contrast), "--moon-wallpaper-saturation": String(appearance.wallpaper.saturation), "--moon-wallpaper-hue": `${appearance.wallpaper.hue}deg`, "--moon-wallpaper-dim": String(appearance.wallpaper.dim)
    };
    Object.entries(variables).forEach(([name, value]) => this.root.style.setProperty(name, value));
    document.body.style.fontFamily = typography.family;
    document.body.style.fontSize = `${typography.baseSize * typography.scale}px`;
    document.body.style.fontWeight = String(typography.weight);
    document.body.style.lineHeight = String(typography.lineHeight);
    document.body.style.letterSpacing = `${typography.letterSpacing}em`;
    this.#watchSystem(appearance.mode);
  }

  dispose(): void { if (this.#media && this.#listener) this.#media.removeEventListener("change", this.#listener); }

  #resolveMode(mode: ThemeMode, lightAt: string, darkAt: string): "light" | "dark" {
    if (mode === "light" || mode === "dark") return mode;
    if (mode === "system") return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const now = new Date(); const minutes = now.getHours() * 60 + now.getMinutes(); const [lh, lm] = lightAt.split(":").map(Number); const [dh, dm] = darkAt.split(":").map(Number); const light = lh! * 60 + lm!; const dark = dh! * 60 + dm!;
    return light < dark ? (minutes >= light && minutes < dark ? "light" : "dark") : (minutes >= light || minutes < dark ? "light" : "dark");
  }

  #watchSystem(mode: ThemeMode): void {
    if (this.#media && this.#listener) this.#media.removeEventListener("change", this.#listener);
    this.#media = undefined; this.#listener = undefined;
    if (mode !== "system") return;
    this.#media = matchMedia("(prefers-color-scheme: light)");
    this.#listener = () => { if (this.#config) this.apply(this.#config); };
    this.#media.addEventListener("change", this.#listener);
  }
}

function mix(first: string, second: string, ratio: number): string { const channel = (hex: string, index: number): number => Number.parseInt(hex.slice(index, index + 2), 16); const value = [1, 3, 5].map(index => Math.round(channel(first, index) * (1 - ratio) + channel(second, index) * ratio).toString(16).padStart(2, "0")); return `#${value.join("")}`; }
