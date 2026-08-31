import { button, element, icon } from "../browser-shell/dom.js";
import type { CustomizationConfig } from "./customization-schema.js";

export class LiveBrowserPreview {
  readonly element = element("section", "moon-live-preview");
  readonly #frame = element("div", "moon-live-preview-frame");

  constructor() { this.element.setAttribute("aria-label", "Prévia compacta do navegador"); this.element.append(element("span", "moon-live-preview-label", "PRÉVIA AO VIVO"), this.#frame); }

  apply(config: CustomizationConfig): void {
    const { appearance, home, layout, workspaceDisplay } = config; this.#frame.replaceChildren();
    this.#frame.dataset.sidebar = layout.sidebar.position; this.#frame.dataset.tabs = layout.tabs.position; this.#frame.dataset.toolbar = layout.toolbar.position; this.#frame.dataset.workspaces = workspaceDisplay.visibility; this.#frame.dataset.density = layout.density; this.#frame.dataset.newTab = layout.tabs.newTabButton;
    this.#frame.style.setProperty("--preview-accent", appearance.colors.accent); this.#frame.style.setProperty("--preview-background", appearance.colors.background); this.#frame.style.setProperty("--preview-surface", appearance.colors.surface); this.#frame.style.setProperty("--preview-text", appearance.colors.text); this.#frame.style.setProperty("--preview-sidebar-color", appearance.regions.sidebar); this.#frame.style.setProperty("--preview-toolbar-color", appearance.regions.toolbar); this.#frame.style.setProperty("--preview-tabs-color", appearance.regions.tabs); this.#frame.style.setProperty("--preview-home-color", appearance.regions.home); this.#frame.style.setProperty("--preview-sidebar", `${Math.max(12, layout.sidebar.width / 4)}px`); this.#frame.style.setProperty("--preview-radius", `${Math.max(2, appearance.shape.radius / 3)}px`);
    const tabs = element("div", "moon-preview-tabs"); tabs.dataset.position = layout.tabs.newTabButton; tabs.append(element("span"), element("span", "is-active"), element("span")); if (["after-tabs", "before-tabs", "end-bar"].includes(layout.tabs.newTabButton)) tabs.append(button("moon-preview-add-tab", "Nova aba na prévia", "plus"));
    const toolbar = element("div", "moon-preview-toolbar"); toolbar.append(icon("back"), element("span", "moon-preview-address"), icon("reload")); if (layout.tabs.newTabButton === "toolbar") toolbar.append(icon("plus"));
    const sidebar = element("div", "moon-preview-sidebar"); sidebar.append(...(["moon", "home", "grid", "star", "settings"] as const).map(name => button("", name, name)));
    if (layout.tabs.newTabButton === "sidebar") sidebar.append(button("moon-preview-add-tab", "Nova aba na sidebar da prévia", "plus"));
    const workspaces = element("div", "moon-preview-workspaces"); workspaces.append(element("span", "is-active", "Pesquisa"), element("span", "", "Estudos"));
    const page = element("div", "moon-preview-page"); const wallpaper = element("span", "moon-preview-wallpaper"); const wallpaperSource = appearance.wallpaper.type === "https" ? appearance.wallpaper.cachedData : appearance.wallpaper.type === "animated" ? appearance.wallpaper.fallbackData ?? appearance.wallpaper.source : appearance.wallpaper.source;
    if (appearance.wallpaper.type === "color") wallpaper.style.backgroundColor = appearance.wallpaper.source;
    else if (appearance.wallpaper.type === "gradient") wallpaper.style.backgroundImage = appearance.wallpaper.source;
    else if (wallpaperSource) wallpaper.style.backgroundImage = `url(${JSON.stringify(wallpaperSource)})`;
    wallpaper.style.backgroundSize = appearance.wallpaper.fit; wallpaper.style.backgroundPosition = appearance.wallpaper.position; wallpaper.style.backgroundRepeat = appearance.wallpaper.repeat ? "repeat" : "no-repeat"; wallpaper.style.opacity = String(appearance.wallpaper.opacity); wallpaper.style.filter = `blur(${Math.min(appearance.wallpaper.blur, 8)}px) brightness(${appearance.wallpaper.brightness}) contrast(${appearance.wallpaper.contrast}) saturate(${appearance.wallpaper.saturation}) hue-rotate(${appearance.wallpaper.hue}deg)`;
    const homePreview = element("div", "moon-preview-home"); const brand = element("div", "moon-preview-brand"); brand.append(icon("moon"), element("strong", "", home.greeting)); homePreview.append(brand, element("span", "moon-preview-search"));
    const widgets = element("div", "moon-preview-widgets"); widgets.style.gridTemplateColumns = `repeat(${home.columns}, minmax(0, 1fr))`; for (const widget of [...home.widgets].filter(candidate => candidate.visible).sort((a, b) => a.order - b.order).slice(0, 6)) { const card = element("span", "moon-preview-widget", widget.id); card.dataset.widget = widget.id; card.style.gridColumn = `span ${Math.min(home.columns, widget.columns)}`; widgets.append(card); } homePreview.append(widgets); page.append(wallpaper, element("span", "moon-preview-dim"), homePreview);
    this.#frame.append(tabs, toolbar, sidebar, workspaces, page);
  }
}
