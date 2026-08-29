import { button, element, icon } from "../browser-shell/dom.js";
import type { CustomizationConfig } from "./customization-schema.js";

export class LiveBrowserPreview {
  readonly element = element("section", "moon-live-preview");
  readonly #frame = element("div", "moon-live-preview-frame");

  constructor() { this.element.setAttribute("aria-label", "Prévia compacta do navegador"); this.element.append(element("span", "moon-live-preview-label", "PRÉVIA AO VIVO"), this.#frame); }

  apply(config: CustomizationConfig): void {
    const { appearance, layout, workspaceDisplay } = config; this.#frame.replaceChildren();
    this.#frame.dataset.sidebar = layout.sidebar.position; this.#frame.dataset.tabs = layout.tabs.position; this.#frame.dataset.toolbar = layout.toolbar.position; this.#frame.dataset.workspaces = workspaceDisplay.visibility;
    this.#frame.style.setProperty("--preview-accent", appearance.colors.accent); this.#frame.style.setProperty("--preview-sidebar", `${Math.max(12, layout.sidebar.width / 4)}px`); this.#frame.style.setProperty("--preview-radius", `${Math.max(2, appearance.shape.radius / 3)}px`);
    const tabs = element("div", "moon-preview-tabs"); tabs.append(element("span"), element("span", "is-active"), element("span"));
    const toolbar = element("div", "moon-preview-toolbar"); toolbar.append(icon("back"), element("span", "moon-preview-address"), icon("reload"));
    const sidebar = element("div", "moon-preview-sidebar"); sidebar.append(...["home", "grid", "star", "settings"].map(name => button("", name, name as "home")));
    const workspaces = element("div", "moon-preview-workspaces"); workspaces.append(element("span", "is-active", "Pesquisa"), element("span", "", "Estudos"));
    const page = element("div", "moon-preview-page"); page.append(element("span", "moon-preview-orb"), element("strong", "", "Moon"), element("span", "moon-preview-search"));
    this.#frame.append(tabs, toolbar, sidebar, workspaces, page);
  }
}
