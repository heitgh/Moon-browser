import { button, element } from "../dom.js";
import type { LayoutSettings } from "../../customization/customization-schema.js";

export interface ToolbarActions {
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onReload: () => void;
  readonly onHome: () => void;
  readonly onNavigate: (value: string) => void;
  readonly onToggleBookmark: () => void;
  readonly onOpenSecurity: () => void;
  readonly onOpenAi: () => void;
  readonly onOpenDownloads: () => void;
  readonly onOpenModules: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenMenu: () => void;
}

export class Toolbar {
  readonly element = element("div", "moon-toolbar-v2");
  readonly omnibox = element("input", "moon-omnibox");
  readonly back = button("moon-nav-button", "Voltar", "back");
  readonly forward = button("moon-nav-button", "Avançar", "forward");
  readonly reload = button("moon-nav-button", "Recarregar", "reload");
  readonly home = button("moon-nav-button", "Página inicial pela toolbar", "home");
  readonly bookmark = button("moon-nav-button moon-bookmark-button", "Adicionar aos favoritos", "star");
  readonly securityPill = button("moon-security-pill", "Proteção e AdBlock", "shield");
  readonly securityText = element("span", "moon-security-text", "AdBlock carregando");
  readonly downloads = button("moon-nav-button", "Abrir downloads pela toolbar", "download");
  readonly modules = button("moon-nav-button", "Abrir módulos pela toolbar", "plugin");
  readonly profile = button("moon-nav-button", "Abrir workspaces e perfil", "grid");
  readonly menu = button("moon-nav-button", "Abrir menu do Moon", "settings");
  readonly ai = button("moon-ai-button", "Abrir Moon AI", "sparkles");
  readonly address = element("form", "moon-address");
  readonly spacer = element("span", "moon-toolbar-spacer");

  constructor(readonly actions: ToolbarActions, readonly features: { readonly ai: boolean; readonly modules: boolean } = { ai: false, modules: false }) {
    this.back.addEventListener("click", actions.onBack);
    this.forward.addEventListener("click", actions.onForward);
    this.reload.addEventListener("click", actions.onReload);
    this.home.addEventListener("click", actions.onHome);
    this.bookmark.addEventListener("click", actions.onToggleBookmark);
    this.securityPill.append(this.securityText);
    this.securityPill.addEventListener("click", actions.onOpenSecurity);

    this.omnibox.type = "text";
    this.omnibox.autocomplete = "off";
    this.omnibox.spellcheck = false;
    this.omnibox.placeholder = "Pesquise ou digite um endereço";
    this.omnibox.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      actions.onNavigate(this.omnibox.value);
    });
    const go = button("moon-go-button", "Abrir endereço", "chevron");
    go.addEventListener("click", () => actions.onNavigate(this.omnibox.value));
    this.address.append(this.securityPill, this.omnibox, go);
    this.address.addEventListener("submit", event => {
      event.preventDefault();
      actions.onNavigate(this.omnibox.value);
    });

    this.ai.append(element("span", "", "Moon AI"));
    this.ai.addEventListener("click", actions.onOpenAi);
    this.downloads.addEventListener("click", actions.onOpenDownloads);
    this.modules.addEventListener("click", actions.onOpenModules);
    this.profile.addEventListener("click", actions.onOpenProfile);
    this.menu.addEventListener("click", actions.onOpenMenu);
    this.element.append(this.back, this.forward, this.reload, this.address, this.bookmark, this.ai);
  }

  applyLayout(layout: LayoutSettings): void {
    const nodes = {
      back: this.back, forward: this.forward, reload: this.reload, home: this.home, omnibox: this.address,
      bookmark: this.bookmark, downloads: this.downloads, modules: this.modules, ai: this.ai,
      profile: this.profile, menu: this.menu, spacer: this.spacer
    } as const;
    const ordered: HTMLElement[] = [];
    for (const item of layout.toolbar.items) { const node = nodes[item.id]; const available = item.id === "ai" ? this.features.ai : item.id === "modules" ? this.features.modules : true; node.hidden = !item.visible || !available; ordered.push(node); }
    this.element.replaceChildren(...ordered);
    this.element.classList.toggle("is-auto-hide", layout.toolbar.autoHide);
  }

  focusOmnibox(): void {
    this.address.hidden = false;
    this.omnibox.focus(); this.omnibox.select();
  }
}
