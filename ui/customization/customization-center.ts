import { button, clearIconOverrides, element, icon, installIconOverrides, type IconName } from "../browser-shell/dom.js";
import {
  WALLPAPER_PRESETS,
  DEFAULT_CUSTOMIZATION,
  clone,
  contrast,
  type CustomizationConfig,
  type HomePreset,
  type HomeWidgetId,
  type SearchProvider,
  type ToolbarItemId
} from "./customization-schema.js";
import { CustomizationStore } from "./customization-store.js";
import type { MoonThemePayload, MoonThemePreview, MoonThemeSummary, Shortcut } from "../browser-shell/contracts.js";
import { LiveBrowserPreview } from "./live-browser-preview.js";
import { searchSettings, type SettingsSection } from "./settings-catalog.js";
import type { SettingsMode, SettingsView } from "./customization-schema.js";
import type { ImportCategory, ImportResult, ImportSourceSummary } from "../../packages/ipc/browser-import-contract.js";
import { applyHomePreset } from "./home-presets.js";
import { buildThemeCatalog, type ThemeCatalogEntry } from "./theme-catalog.js";
import { extractPalette } from "./palette-extractor.js";

export interface CustomizationCenterOptions {
  readonly store: CustomizationStore;
  readonly workspaceName: string;
  readonly onClose: (applied: boolean) => void | Promise<void>;
  readonly onExport: (content: string) => Promise<boolean>;
  readonly onExportDiagnostic: (content: string) => Promise<boolean>;
  readonly onImport: () => Promise<string | null>;
  readonly onFetchWallpaper: (url: string) => Promise<string>;
  readonly onImportMoonTheme: () => Promise<MoonThemePreview | null>;
  readonly onConfirmMoonTheme: (intentId: string) => Promise<MoonThemeSummary>;
  readonly onCancelMoonTheme: (intentId: string) => Promise<void>;
  readonly onListMoonThemes: () => Promise<readonly MoonThemeSummary[]>;
  readonly onApplyMoonTheme: (id: string) => Promise<MoonThemePayload>;
  readonly onActivateMoonTheme: (id: string) => Promise<MoonThemeSummary>;
  readonly onRollbackMoonTheme: (packageId: string) => Promise<MoonThemePayload>;
  readonly onRemoveMoonTheme: (id: string) => Promise<void>;
  readonly onExportMoonTheme: (id: string) => Promise<boolean>;
  readonly presentation?: "modal" | "page";
  readonly initialSection?: SettingsSection;
  readonly onOpenPage?: (section: SettingsSection) => void | Promise<void>;
  readonly onNavigateSection?: (section: SettingsSection, mode: SettingsMode) => void | Promise<void>;
  readonly shortcuts: () => readonly Shortcut[];
  readonly onAddShortcut: (shortcut: Omit<Shortcut, "id">) => void;
  readonly onRemoveShortcut: (id: string) => void;
  readonly onDiscoverImportSources: () => Promise<readonly ImportSourceSummary[]>;
  readonly onImportBrowserProfile: (sourceId: string, categories: readonly ImportCategory[]) => Promise<ImportResult>;
  readonly onImportBookmarksHtml: () => Promise<ImportResult | null>;
}

type SectionId = "appearance" | "layout" | "home" | "typography" | "search" | "data";
type SelectOption = readonly [string, string];
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const SECTIONS: readonly [SectionId, string, IconName, string][] = [
  ["appearance", "Aparência", "palette", "Cores, temas, wallpaper e efeitos"],
  ["layout", "Layout e densidade", "grid", "Sidebar, toolbar e omnibox"],
  ["home", "Home e widgets", "home", "Grid, cartões e módulos"],
  ["typography", "Tipografia", "note", "Fontes, escalas e legibilidade"],
  ["search", "Pesquisa", "search", "Buscadores e keywords"],
  ["data", "Workspaces e dados", "download", "Escopo, portabilidade e reset"]
];

const WIDGET_LABELS: Readonly<Record<HomeWidgetId, string>> = {
  clock: "Relógio", date: "Data", greeting: "Saudação", search: "Busca", shortcuts: "Atalhos",
  favorites: "Favoritos", recentTabs: "Abas recentes", sessions: "Sessões", tasks: "Tarefas", notes: "Notas",
  downloads: "Downloads", focus: "Foco", calendar: "Calendário", reading: "Leitura", performance: "Performance"
};

const TOOLBAR_LABELS: Readonly<Record<ToolbarItemId, string>> = {
  back: "Voltar", forward: "Avançar", reload: "Recarregar", home: "Home", omnibox: "Omnibox",
  bookmark: "Favoritos", downloads: "Downloads", modules: "Módulos", ai: "IA", profile: "Perfil", menu: "Menu", spacer: "Espaço flexível"
};

export class CustomizationCenter {
  readonly element = element("div", "moon-settings-overlay");
  readonly #modal = element("section", "moon-settings-modal moon-customization-modal");
  readonly #sidebar = element("aside", "moon-settings-sidebar");
  readonly #body = element("div", "moon-settings-body");
  readonly #content = element("div", "moon-customization-content");
  readonly #search = element("input", "moon-settings-search");
  readonly #crumb = element("span", "moon-settings-crumb");
  readonly #scope = element("select", "moon-select moon-scope-select");
  readonly #message = element("div", "moon-settings-message");
  readonly #live = element("div", "moon-visually-hidden");
  readonly #preview = new LiveBrowserPreview();
  readonly #previewToggle = button("moon-secondary-button moon-preview-toggle", "Recolher prévia", "grid");
  readonly #footerState = element("strong", "", "Sem alterações pendentes");
  readonly #undo = button("moon-secondary-button", "Desfazer", "back");
  readonly #redo = button("moon-secondary-button", "Refazer", "forward");
  readonly #closeControl = button("moon-settings-close", "Fechar e cancelar alterações", "close");
  #active: SectionId;
  #mode: SettingsMode;
  #view: SettingsView;
  #presentation: "modal" | "page";
  #moonThemes: readonly MoonThemeSummary[] = [];
  #pendingMoonTheme: MoonThemePreview | undefined;
  #selectedMoonThemeId: string | undefined;
  #selectedThemeId: string | undefined;
  #previewCollapsed = false;
  #importSources: readonly ImportSourceSummary[] = [];

  constructor(readonly options: CustomizationCenterOptions) {
    this.#active = options.initialSection ?? options.store.document.experience.lastSection as SectionId;
    this.#mode = options.store.document.experience.mode;
    this.#view = options.store.document.experience.view;
    this.#presentation = options.presentation ?? "modal";
    options.store.beginPreview();
    this.#build();
    this.#render();
    void this.#loadMoonThemes();
    requestAnimationFrame(() => this.#search.focus());
  }

  get presentation(): "modal" | "page" { return this.#presentation; }
  cancel(): Promise<void> { return this.#close(false); }

  setPresentation(presentation: "modal" | "page"): void {
    this.#presentation = presentation;
    this.element.dataset.presentation = presentation;
    this.#modal.setAttribute("role", presentation === "page" ? "region" : "dialog");
    if (presentation === "page") this.#modal.removeAttribute("aria-modal"); else this.#modal.setAttribute("aria-modal", "true");
    const label = presentation === "page" ? "Voltar à página inicial" : "Fechar e cancelar alterações";
    this.#closeControl.title = label; this.#closeControl.setAttribute("aria-label", label);
  }

  #build(): void {
    this.element.dataset.testid = "customization-center";
    this.#modal.setAttribute("aria-labelledby", "moon-customization-title");
    const brand = element("div", "moon-settings-brand"); brand.append(icon("moon"), element("span", "", "Moon Studio"));
    const title = element("h2", "", "Personalização"); title.id = "moon-customization-title";
    this.#search.type = "search"; this.#search.placeholder = "Buscar configuração"; this.#search.setAttribute("aria-label", "Buscar nas configurações"); this.#search.addEventListener("input", () => this.#render());
    const modes = element("div", "moon-settings-modes"); (["simple", "advanced"] as const).forEach(mode => { const labels = { simple: "Simples", advanced: "Avançado" }; const control = button("moon-settings-mode", labels[mode]); control.append(element("span", "", labels[mode])); control.dataset.mode = mode; control.addEventListener("click", () => { this.#mode = mode; this.#view = "section"; this.options.store.setExperience(mode, this.#active, this.#view); this.#search.value = ""; this.#render(); void this.options.onNavigateSection?.(this.#active, mode); }); modes.append(control); });
    const viewAll = button("moon-settings-mode moon-settings-view-all", "Ver todas as configurações"); viewAll.append(element("span", "", "Ver tudo")); viewAll.dataset.view = "all"; viewAll.addEventListener("click", () => { this.#mode = "advanced"; this.#view = "all"; this.options.store.setExperience(this.#mode, this.#active, this.#view); this.#search.value = ""; this.#render(); void this.options.onNavigateSection?.(this.#active, this.#mode); }); modes.append(viewAll);
    this.#sidebar.append(brand, title, modes, this.#search);
    for (const [id, label, iconName, description] of SECTIONS) {
      const nav = button("moon-settings-nav", label, iconName); nav.dataset.section = id;
      const copy = element("span", "moon-settings-nav-copy"); copy.append(element("strong", "", label), element("small", "", description)); nav.append(copy);
      nav.addEventListener("click", () => {
        this.#active = id;
        this.#view = "section";
        this.options.store.setExperience(this.#mode, id, this.#view);
        this.#search.value = "";
        this.#render();
        void this.options.onNavigateSection?.(id, this.#mode);
      }); this.#sidebar.append(nav);
    }
    if (this.options.presentation !== "page" && this.options.onOpenPage) { const openPage = button("moon-settings-open-page", "Abrir configurações em página completa", "chevron"); openPage.append(element("span", "", "Abrir em página completa")); openPage.addEventListener("click", () => { window.setTimeout(() => void this.options.onOpenPage?.(this.#active), 0); }); this.#sidebar.append(openPage); }
    this.#scope.append(option("global", "Aplicar globalmente"), option("workspace", `Somente ${this.options.workspaceName}`));
    this.#scope.setAttribute("aria-label", "Escopo das configurações");
    this.#scope.addEventListener("change", () => { this.options.store.setScope(this.#scope.value as "global" | "workspace"); this.#say(`Escopo: ${this.#scope.selectedOptions[0]?.textContent ?? ""}.`); this.#render(); });
    const breadcrumbs = element("div", "moon-settings-breadcrumbs"); breadcrumbs.append(element("span", "", "Configurações"), element("span", "", "/"), this.#crumb);
    this.#previewToggle.append(element("span", "", "Prévia")); this.#previewToggle.addEventListener("click", () => { this.#previewCollapsed = !this.#previewCollapsed; this.#syncPreviewState(); });
    const topbarActions = element("div", "moon-settings-topbar-actions"); topbarActions.append(this.#previewToggle, this.#scope);
    const topbar = element("header", "moon-settings-topbar"); topbar.append(breadcrumbs, topbarActions);
    this.#closeControl.addEventListener("click", () => void this.#close(false));
    this.#message.setAttribute("role", "status"); this.#live.setAttribute("aria-live", "polite");
    const footer = element("footer", "moon-settings-footer");
    this.#undo.append(element("span", "", "Desfazer")); this.#redo.append(element("span", "", "Refazer"));
    this.#undo.addEventListener("click", () => { if (this.options.store.undo()) { this.#say("Alteração desfeita."); this.#render(); } });
    this.#redo.addEventListener("click", () => { if (this.options.store.redo()) { this.#say("Alteração refeita."); this.#render(); } });
    const cancel = button("moon-secondary-button", "Cancelar mudanças"); cancel.append(element("span", "", "Cancelar")); cancel.addEventListener("click", () => void this.#close(false));
    const apply = button("moon-primary-button", "Aplicar personalização"); apply.append(element("span", "", "Aplicar mudanças")); apply.addEventListener("click", () => void this.#close(true));
    const footerCopy = element("div", "moon-settings-footer-copy"); footerCopy.append(this.#footerState, element("small", "", "Aplicação imediata · cancelar restaura o estado anterior."));
    const actions = element("div", "moon-settings-footer-actions"); actions.append(this.#undo, this.#redo, cancel, apply); footer.append(footerCopy, actions);
    this.#body.append(topbar, this.#message, this.#content, footer, this.#live); this.#modal.append(this.#sidebar, this.#body, this.#closeControl); this.element.append(this.#modal); this.setPresentation(this.#presentation);
    this.element.addEventListener("click", event => { if (event.target === this.element) void this.#close(false); });
    this.#modal.addEventListener("keydown", event => this.#keys(event));
  }

  #render(): void {
    const section = SECTIONS.find(([id]) => id === this.#active)!;
    const query = this.#search.value.trim(); this.#crumb.textContent = query ? "Resultados da busca" : this.#mode === "simple" ? "Simples" : this.#view === "all" ? "Todas as configurações" : section[1]; this.#scope.value = this.options.store.document.scope;
    this.#sidebar.querySelectorAll<HTMLElement>(".moon-settings-nav").forEach(node => node.classList.toggle("is-active", node.dataset.section === this.#active));
    this.#sidebar.querySelectorAll<HTMLElement>(".moon-settings-mode").forEach(node => node.classList.toggle("is-active", node.dataset.mode === this.#mode));
    this.#sidebar.querySelector<HTMLElement>(".moon-settings-view-all")?.classList.toggle("is-active", this.#mode === "advanced" && this.#view === "all");
    this.#undo.disabled = !this.options.store.canUndo; this.#redo.disabled = !this.options.store.canRedo;
    this.#content.replaceChildren(); this.#content.dataset.searching = query ? "true" : "false";
    const config = this.options.store.config; this.#preview.apply(config);
    this.#syncPreviewState(); this.#footerState.textContent = this.options.store.dirty ? "Alterações ainda não aplicadas" : "Sem alterações pendentes"; this.#footerState.dataset.dirty = this.options.store.dirty ? "true" : "false";
    if (query) { this.#searchResults(query); return; }
    if (this.#mode === "simple") this.#essential(config);
    else if (this.#view === "all") { this.#content.append(this.#preview.element); for (const id of SECTIONS.map(([sectionId]) => sectionId)) this.#renderSection(id, config); }
    else { this.#content.append(this.#preview.element); this.#renderSection(this.#active, config); }
    this.#filter();
  }

  #renderSection(id: SectionId, config: CustomizationConfig): void {
    const marker = element("span", "moon-settings-anchor"); marker.id = `moon-settings-${id}`; marker.tabIndex = -1; this.#content.append(marker);
    const previous = this.#active; this.#active = id;
    if (id === "appearance") this.#appearance(config); else if (id === "layout") this.#layout(config); else if (id === "home") this.#home(config); else if (id === "typography") this.#typography(config); else if (id === "search") this.#searchPage(config); else this.#data(config);
    this.#active = previous;
  }

  #searchResults(query: string): void {
    const results = searchSettings(query); const heading = element("header", "moon-settings-page-intro"); heading.append(element("h1", "", "Resultados"), element("p", "", results.length ? `${results.length} configurações encontradas por título, descrição ou intenção.` : `Nada encontrado para “${query}”.`)); this.#content.append(heading);
    const list = element("div", "moon-settings-results");
    for (const result of results) { const item = button("moon-settings-result", `Abrir ${result.title}`); const copy = element("span", "moon-list-copy"); copy.append(element("small", "", `${result.category} · ${result.level === "simple" ? "Simples" : "Avançado"}`), element("strong", "", result.title), element("p", "", result.description)); item.append(copy, icon("chevron")); item.addEventListener("click", () => { this.#active = result.section; this.#mode = "advanced"; this.#view = "section"; this.options.store.setExperience(this.#mode, result.section, this.#view); this.#search.value = ""; this.#render(); void this.options.onNavigateSection?.(result.section, this.#mode); requestAnimationFrame(() => { const target = this.#content.querySelector<HTMLElement>(`#moon-settings-${result.section}`); target?.focus(); target?.parentElement?.classList.add("is-highlighted"); }); }); list.append(item); }
    this.#content.append(list);
  }

  #essential(config: CustomizationConfig): void {
    this.#intro("Personalize o essencial", "Decisões visuais rápidas, com termos simples e preview antes de confirmar."); this.#content.append(this.#preview.element);
    const appearance = this.#group("Aparência rápida", "Escolha como o Moon deve parecer.", "claro escuro automático tema"); const modes = element("div", "moon-visual-options"); (["light", "dark", "system"] as const).forEach(mode => { const labels = { light: "Claro", dark: "Escuro", system: "Automático" }; const card = button(`moon-visual-choice${config.appearance.mode === mode ? " is-active" : ""}`, labels[mode], mode === "dark" ? "moon" : mode === "light" ? "palette" : "settings"); card.append(element("strong", "", labels[mode])); card.addEventListener("click", () => { this.#set("appearance.mode", mode); this.#render(); }); modes.append(card); }); appearance.append(modes);
    const density = this.#group("Conforto da interface", "Quatro pontos de partida; ajustes manuais continuam no modo Avançado.", "densidade compacto equilibrado confortável toque"); const presets = element("div", "moon-visual-options"); (["compact", "comfortable", "touch"] as const).forEach(value => { const labels = { compact: "Compacto", comfortable: "Equilibrado", touch: "Toque" }; const card = button(`moon-visual-choice${config.layout.density === value ? " is-active" : ""}`, labels[value], "grid"); card.append(element("strong", "", labels[value])); card.addEventListener("click", () => this.#density(value)); presets.append(card); }); const comfortable = button("moon-visual-choice", "Confortável", "grid"); comfortable.append(element("strong", "", "Confortável")); comfortable.addEventListener("click", () => { this.options.store.update(next => { (next.layout as Mutable<typeof next.layout>).density = "custom"; (next.layout as Mutable<typeof next.layout>).uiScale = 1.1; }); this.#render(); }); presets.append(comfortable); density.append(presets);
    const tabs = this.#group("Abas", "Use abas no topo ou uma lista vertical nas laterais.", "abas topo vertical esquerda direita"); tabs.append(this.#select("Posição das abas", config.layout.tabs.position, [["top", "No topo"], ["left", "Vertical à esquerda"], ["right", "Vertical à direita"]], value => { this.#set("layout.tabs.position", value); this.#render(); }));
    const sidebar = this.#group("Sidebar", "Posição e largura com recuperação sempre disponível por Ctrl+,.", "sidebar posição largura grossura"); const positions = element("div", "moon-visual-options"); (["left", "right", "collapsed"] as const).forEach(value => { const labels = { left: "Esquerda", right: "Direita", collapsed: "Recolhida" }; const card = button(`moon-visual-choice${config.layout.sidebar.position === value ? " is-active" : ""}`, labels[value], "grid"); card.append(element("strong", "", labels[value])); card.addEventListener("click", () => { this.#set("layout.sidebar.position", value); this.#render(); }); positions.append(card); }); sidebar.append(positions, this.#select("Largura", String(config.layout.sidebar.width), [["44", "Estreita"], ["56", "Padrão"], ["88", "Larga"]], value => this.#set("layout.sidebar.width", Number(value))));
    const workspace = this.#group("Workspaces", "Escolha quanto espaço elas ocupam sem perder o acesso pelo teclado ou menu.", "workspaces esconder espaços visibilidade"); workspace.append(this.#select("Exibição", config.workspaceDisplay.visibility, [["always", "Sempre visíveis"], ["collapsed", "Seletor compacto"], ["hover", "Ao passar o mouse"], ["home-only", "Somente na Home"], ["hidden", "Ocultas, acessíveis por Ctrl+Shift+W"]], value => { this.#set("workspaceDisplay.visibility", value); this.#render(); }));
    const home = this.#group("Home", "Escolha um ponto de partida para a nova aba.", "home nova aba widgets"); const homes = element("div", "moon-visual-options"); (["minimal", "focus", "study", "work"] as const).forEach(value => { const labels = { minimal: "Minimalista", focus: "Foco", study: "Estudo", work: "Trabalho" }; const card = button(`moon-visual-choice${config.home.preset === value ? " is-active" : ""}`, labels[value], "home"); card.append(element("strong", "", labels[value])); card.addEventListener("click", () => this.#homePreset(value)); homes.append(card); }); home.append(homes);
    const search = this.#group("Pesquisa e privacidade", "Buscador e símbolos dos sites, com cache local opcional.", "buscador privacidade favicon"); search.append(this.#select("Buscador", config.search.defaultEngine, config.search.providers.map(provider => [provider.id, provider.name] as const), value => this.#set("search.defaultEngine", value)), this.#toggle("Exibir símbolos dos sites", config.favicons.enabled, value => this.#set("favicons.enabled", value)));
    this.#content.append(appearance, density, tabs, sidebar, workspace, home, search, this.#importControls());
  }

  #appearance(config: CustomizationConfig): void {
    this.#intro("Aparência", "Identidade completa, contraste validado e retorno seguro ao tema anterior.");
    const mode = this.#group("Modo e agenda", "Claro, escuro, sistema ou alternância por horário.", "tema claro escuro sistema agendado horário");
    mode.append(this.#select("Modo", config.appearance.mode, [["system", "Sistema"], ["light", "Claro"], ["dark", "Escuro"], ["scheduled", "Agendado"]], value => this.#set("appearance.mode", value)), this.#input("Tema claro às", config.appearance.schedule.lightAt, "time", value => this.#set("appearance.schedule.lightAt", value)), this.#input("Tema escuro às", config.appearance.schedule.darkAt, "time", value => this.#set("appearance.schedule.darkAt", value)));

    const colors = this.#group("Editor livre de cores", "HEX e seletor visual. Texto ilegível é rejeitado.", "background surface elevated text accent border success warning danger contraste");
    const grid = element("div", "moon-color-grid");
    const colorFields: readonly [keyof CustomizationConfig["appearance"]["colors"], string][] = [["background", "Fundo"], ["surface", "Superfície"], ["elevated", "Elevada"], ["text", "Texto"], ["textMuted", "Texto secundário"], ["accent", "Destaque"], ["border", "Borda"], ["success", "Sucesso"], ["warning", "Aviso"], ["danger", "Perigo"]];
    colorFields.forEach(([key, label]) => grid.append(this.#color(label, config.appearance.colors[key], value => this.#set(`appearance.colors.${key}`, value))));
    const ratio = contrast(config.appearance.colors.text, config.appearance.colors.background); grid.append(element("output", `moon-contrast-badge${ratio >= 4.5 ? " is-good" : ""}`, `Contraste ${ratio.toFixed(2)}:1`)); colors.append(grid);
    const regions = this.#group("Cores por região", "Tokens semânticos independentes para chrome, Home, conteúdo e seleção.", "toolbar tabs sidebar home conteúdo seleção regiões extrair paleta imagem local"); const regionGrid = element("div", "moon-color-grid"); const regionFields: readonly [keyof CustomizationConfig["appearance"]["regions"], string][] = [["toolbar", "Toolbar"], ["tabs", "Abas"], ["sidebar", "Sidebar"], ["home", "Home"], ["content", "Conteúdo"], ["selection", "Seleção"]]; regionFields.forEach(([key, label]) => regionGrid.append(this.#color(label, config.appearance.regions[key], value => this.#set(`appearance.regions.${key}`, value)))); regions.append(regionGrid, this.#paletteFile());

    const wallpaper = this.#group("Wallpaper e filtros", "Arquivo local, URL HTTPS, cor ou gradiente, sem serviços externos ocultos.", "wallpaper local url gradiente contain cover fill opacidade blur brilho contraste saturação hue escurecimento");
    const gallery = element("div", "moon-wallpaper-grid");
    for (const preset of WALLPAPER_PRESETS) { const card = button(`moon-wallpaper${preset.source === config.appearance.wallpaper.source ? " is-active" : ""}`, `Usar ${preset.name}`); card.style.backgroundImage = `url(${JSON.stringify(preset.source)})`; card.append(element("span", "", preset.name)); card.addEventListener("click", () => { this.options.store.update(next => { const value = next.appearance.wallpaper as Mutable<typeof next.appearance.wallpaper>; value.type = "local"; value.source = preset.source; }); this.#render(); }); gallery.append(card); }
    wallpaper.append(gallery, this.#select("Origem", config.appearance.wallpaper.type, [["local", "Local / Moon"], ["animated", "Animado local"], ["https", "URL HTTPS"], ["color", "Cor sólida"], ["gradient", "Gradiente CSS"]], value => this.#wallpaperType(value)), this.#input("Fonte", config.appearance.wallpaper.source, "text", value => { if (config.appearance.wallpaper.type === "https") void this.#wallpaperSource(value); else return this.#set("appearance.wallpaper.source", value); }, "URL, #cor ou linear-gradient(…)"), this.#file(), this.#select("Ajuste", config.appearance.wallpaper.fit, [["cover", "Cobrir"], ["contain", "Conter"], ["fill", "Preencher"]], value => this.#set("appearance.wallpaper.fit", value)), this.#input("Posição", config.appearance.wallpaper.position, "text", value => this.#set("appearance.wallpaper.position", value)), this.#toggle("Repetir", config.appearance.wallpaper.repeat, value => this.#set("appearance.wallpaper.repeat", value)), this.#rangeGrid([
      ["Opacidade", "appearance.wallpaper.opacity", config.appearance.wallpaper.opacity, 0, 1, .01], ["Desfoque", "appearance.wallpaper.blur", config.appearance.wallpaper.blur, 0, 40, 1],
      ["Brilho", "appearance.wallpaper.brightness", config.appearance.wallpaper.brightness, .2, 2, .05], ["Contraste", "appearance.wallpaper.contrast", config.appearance.wallpaper.contrast, .2, 2, .05],
      ["Saturação", "appearance.wallpaper.saturation", config.appearance.wallpaper.saturation, 0, 2, .05], ["Matiz", "appearance.wallpaper.hue", config.appearance.wallpaper.hue, -180, 180, 1], ["Escurecimento", "appearance.wallpaper.dim", config.appearance.wallpaper.dim, 0, .9, .01]
    ]));

    const effects = this.#group("Vidro, superfícies e movimento", "Opacidade separada e animações reversíveis; prefers-reduced-motion prevalece.", "glass sidebar toolbar cartões drawers menus modais raio borda sombra espaçamento animação");
    effects.append(this.#toggle("Efeito de vidro", config.appearance.glass.enabled, value => this.#set("appearance.glass.enabled", value)), this.#rangeGrid([
      ["Vidro", "appearance.glass.intensity", config.appearance.glass.intensity, 0, 40, 1], ["Sidebar", "appearance.opacity.sidebar", config.appearance.opacity.sidebar, .2, 1, .01],
      ["Toolbar", "appearance.opacity.toolbar", config.appearance.opacity.toolbar, .2, 1, .01], ["Cartões", "appearance.opacity.cards", config.appearance.opacity.cards, .2, 1, .01],
      ["Drawers", "appearance.opacity.drawers", config.appearance.opacity.drawers, .2, 1, .01], ["Menus", "appearance.opacity.menus", config.appearance.opacity.menus, .2, 1, .01],
      ["Modais", "appearance.opacity.modals", config.appearance.opacity.modals, .2, 1, .01], ["Raio", "appearance.shape.radius", config.appearance.shape.radius, 0, 32, 1],
      ["Borda", "appearance.shape.borderWidth", config.appearance.shape.borderWidth, 0, 4, .5], ["Sombras", "appearance.shape.shadow", config.appearance.shape.shadow, 0, 1, .05],
      ["Espaçamento", "appearance.shape.spacing", config.appearance.shape.spacing, .75, 1.5, .05], ["Elevação", "appearance.shape.elevation", config.appearance.shape.elevation, 0, 2, .1]
    ]), this.#toggle("Animações", config.appearance.motion.enabled, value => this.#set("appearance.motion.enabled", value)), this.#range("Velocidade", "appearance.motion.speed", config.appearance.motion.speed, .25, 2, .05));

    const themes = this.#group("Biblioteca de temas", "Uma biblioteca para temas nativos, criações locais e pacotes assinados, com origem e confiança sempre visíveis.", "tema biblioteca salvar nomear duplicar editar excluir oficial local versão");
    const form = element("form", "moon-custom-form"); const name = element("input", "moon-settings-input"); name.placeholder = "Nome do tema"; name.setAttribute("aria-label", "Nome do novo tema"); const save = button("moon-primary-button", "Salvar tema completo", "plus"); save.type = "submit"; save.append(element("span", "", "Salvar tema")); form.append(name, save); form.addEventListener("submit", event => { event.preventDefault(); try { const saved = this.options.store.saveTheme(name.value || `Tema ${this.options.store.document.themes.length + 1}`); this.#selectedThemeId = saved.id; this.#say("Tema salvo na biblioteca local."); this.#render(); } catch (error) { this.#error(error); } }); themes.append(form);
    const importTheme = button("moon-secondary-button", "Importar pacote Moon Theme", "download"); importTheme.append(element("span", "", "Importar .moontheme")); importTheme.addEventListener("click", () => void this.#importMoonTheme()); themes.append(importTheme);
    if (this.#pendingMoonTheme) {
      const pending = this.#pendingMoonTheme; const preview = element("article", "moon-theme-package-preview");
      const copy = element("div", "moon-list-copy"); copy.append(element("strong", "", `${pending.name} · ${pending.version}`), element("small", "", `${pending.author} · ${pending.trust === "official" ? "Assinatura oficial" : "Assinatura local / não oficial"}`), element("p", "", pending.description ?? "Sem descrição."), element("small", "", `Alterações: ${pending.changes.join(", ") || "nenhuma"}`));
      if (pending.wallpaperData) { const image = element("img", "moon-theme-package-image"); image.src = pending.wallpaperData; image.alt = `Prévia de ${pending.name}`; preview.append(image); }
      const cancel = button("moon-secondary-button", "Cancelar importação"); cancel.append(element("span", "", "Cancelar")); cancel.addEventListener("click", () => void this.#cancelMoonTheme());
      const install = button("moon-primary-button", "Instalar e aplicar tema", "palette"); install.append(element("span", "", "Instalar e aplicar")); install.addEventListener("click", () => void this.#confirmMoonTheme());
      const actions = element("div", "moon-theme-package-actions"); actions.append(cancel, install); preview.append(copy, actions); themes.append(preview);
    }
    for (const theme of buildThemeCatalog(this.options.store.document.themes, this.#moonThemes, this.#selectedThemeId)) themes.append(this.#themeCatalogRow(theme));
    this.#content.append(mode, colors, regions, wallpaper, effects, themes);
  }

  #layout(config: CustomizationConfig): void {
    this.#intro("Layout e densidade", "Reposicione o chrome sem perder acesso às ações essenciais.");
    const density = this.#group("Densidade e escala", "Presets compacto, confortável e touch, além do ajuste livre.", "compacto confortável touch escala ui"); density.append(this.#select("Preset", config.layout.density, [["compact", "Compacto"], ["comfortable", "Confortável"], ["touch", "Touch"], ["custom", "Customizado"]], value => this.#density(value)), this.#range("Escala geral", "layout.uiScale", config.layout.uiScale, .8, 1.3, .05));
    const tabs = this.#group("Posição das abas", "No topo para máxima área útil ou nas laterais para títulos longos e muitas abas.", "abas tabs topo vertical esquerda direita largura botão nova aba plus"); tabs.append(this.#select("Posição das abas", config.layout.tabs.position, [["top", "Topo"], ["left", "Vertical à esquerda"], ["right", "Vertical à direita"]], value => this.#set("layout.tabs.position", value)), this.#range("Largura das abas verticais", "layout.tabs.width", config.layout.tabs.width, 180, 360, 4), this.#select("Botão de nova aba", config.layout.tabs.newTabButton, [["after-tabs", "Depois das abas"], ["end-bar", "Fim da barra"], ["before-tabs", "Antes das abas"], ["toolbar", "Na toolbar"], ["sidebar", "Na sidebar"], ["hidden", "Oculto (Ctrl+T continua ativo)"]], value => this.#set("layout.tabs.newTabButton", value)));
    const sidebar = this.#group("Sidebar e drawers", "Posição, labels, largura e modo do painel persistem por escopo.", "sidebar esquerda direita flutuante recolhida oculta ícones labels drawer fixo sobreposto autohide"); sidebar.append(this.#select("Posição da sidebar", config.layout.sidebar.position, [["left", "Esquerda"], ["right", "Direita"], ["floating", "Flutuante"], ["collapsed", "Recolhida"], ["hidden", "Oculta"]], value => this.#set("layout.sidebar.position", value)), this.#select("Labels", config.layout.sidebar.labels, [["always", "Sempre"], ["hover", "Ao passar"], ["never", "Nunca"]], value => this.#set("layout.sidebar.labels", value)), this.#toggle("Ocultar automaticamente", config.layout.sidebar.autoHide, value => this.#set("layout.sidebar.autoHide", value)), this.#range("Atraso para ocultar", "layout.sidebar.hideDelay", config.layout.sidebar.hideDelay, 100, 5000, 100), this.#rangeGrid([["Largura", "layout.sidebar.width", config.layout.sidebar.width, 44, 240, 2], ["Ícones", "layout.sidebar.iconSize", config.layout.sidebar.iconSize, 14, 28, 1], ["Espaçamento", "layout.sidebar.spacing", config.layout.sidebar.spacing, 2, 18, 1]]), this.#select("Drawer", config.layout.drawer.mode, [["fixed", "Fixo"], ["overlay", "Sobreposto"]], value => this.#set("layout.drawer.mode", value)), this.#range("Largura do drawer", "layout.drawer.width", config.layout.drawer.width, 220, 560, 4));
    const workspaces = this.#group("Workspaces", "Controle a barra sem perder a recuperação por Ctrl+Shift+W.", "workspaces visibilidade compacta hover home ocultar"); workspaces.append(this.#select("Exibição", config.workspaceDisplay.visibility, [["always", "Sempre visíveis"], ["collapsed", "Somente a workspace ativa"], ["hover", "Expandir ao passar"], ["auto-hide", "Ocultar automaticamente"], ["home-only", "Somente na Home"], ["hidden", "Ocultas"]], value => this.#set("workspaceDisplay.visibility", value)), this.#toggle("Seletor compacto", config.workspaceDisplay.compactSelector, value => this.#set("workspaceDisplay.compactSelector", value)), element("p", "moon-recovery-note", "Recuperação garantida: Ctrl+Shift+W abre o gerenciador mesmo quando a barra está oculta."));
    const toolbar = this.#group("Toolbar e omnibox", "Posição, altura, visibilidade e ordem são aplicadas no runtime. Alt+↑/↓ reordena.", "toolbar topo baixo autohide omnibox sidebar reordenar teclado"); toolbar.append(this.#select("Toolbar", config.layout.toolbar.position, [["top", "Topo"], ["bottom", "Embaixo"]], value => this.#set("layout.toolbar.position", value)), this.#range("Altura", "layout.toolbar.height", config.layout.toolbar.height, 40, 76, 2), this.#toggle("Ocultar automaticamente", config.layout.toolbar.autoHide, value => this.#set("layout.toolbar.autoHide", value)), this.#select("Omnibox", config.layout.omnibox.position, [["toolbar", "Na toolbar"], ["bottom", "Barra inferior"], ["sidebar", "Na sidebar"]], value => this.#set("layout.omnibox.position", value)));
    const order = element("div", "moon-order-list"); const items = config.layout.toolbar.items;
    items.forEach((item, index) => { const row = element("div", "moon-order-row"); row.tabIndex = 0; row.setAttribute("aria-label", `${TOOLBAR_LABELS[item.id]}, posição ${index + 1}`); const enabled = this.#toggle("Visível", item.visible, value => this.options.store.update(next => { const target = next.layout.toolbar.items.find(candidate => candidate.id === item.id); if (target) (target as { visible: boolean }).visible = value; })); const up = button("moon-icon-button", `Mover ${TOOLBAR_LABELS[item.id]} para cima`, "back"); up.disabled = index === 0; up.addEventListener("click", () => this.#moveToolbar(index, -1)); const down = button("moon-icon-button", `Mover ${TOOLBAR_LABELS[item.id]} para baixo`, "forward"); down.disabled = index === items.length - 1; down.addEventListener("click", () => this.#moveToolbar(index, 1)); row.addEventListener("keydown", event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); this.#moveToolbar(index, event.key === "ArrowUp" ? -1 : 1); } }); row.append(element("span", "moon-order-grip", "⋮⋮"), element("strong", "", TOOLBAR_LABELS[item.id]), enabled, up, down); order.append(row); }); toolbar.append(order);
    const status = this.#group("Barra de status", "A região ARIA continua anunciando erros quando a barra visual está oculta.", "status erro aria"); status.append(this.#toggle("Mostrar barra visual", config.layout.statusBar.visible, value => this.#set("layout.statusBar.visible", value)));
    this.#content.append(density, tabs, sidebar, workspaces, toolbar, status);
  }

  #home(config: CustomizationConfig): void {
    this.#intro("Home e widgets", "Grid real e independente por workspace quando o escopo local está ativo.");
    const grid = this.#group("Preset e grid", "Presets são pontos de partida; editar um valor muda para Customizado.", "minimal focus study work dev colunas gap largura alinhamento padding cards saudação"); grid.append(this.#select("Preset", config.home.preset, [["minimal", "Minimal"], ["focus", "Focus"], ["study", "Study"], ["work", "Work"], ["dev", "Dev"], ["custom", "Customizado"]], value => this.#homePreset(value as HomePreset)), this.#select("Colunas", String(config.home.columns), [["1", "1 coluna"], ["2", "2 colunas"], ["3", "3 colunas"], ["4", "4 colunas"]], value => this.#homeSet("home.columns", Number(value))), this.#select("Cartões", config.home.cardStyle, [["transparent", "Transparentes"], ["solid", "Sólidos"], ["glass", "Vidro"]], value => this.#homeSet("home.cardStyle", value)), this.#rangeGrid([["Gap", "home.gap", config.home.gap, 0, 48, 2], ["Largura", "home.maxWidth", config.home.maxWidth, 480, 1600, 20], ["Padding", "home.padding", config.home.padding, 0, 96, 4]], true), this.#select("Alinhamento horizontal", config.home.horizontalAlign, [["start", "Início"], ["center", "Centro"], ["end", "Fim"]], value => this.#homeSet("home.horizontalAlign", value)), this.#select("Alinhamento vertical", config.home.verticalAlign, [["start", "Topo"], ["center", "Centro"], ["end", "Base"]], value => this.#homeSet("home.verticalAlign", value)), this.#input("Saudação", config.home.greeting, "text", value => this.#homeSet("home.greeting", value)));
    const widgets = this.#group("Widgets", "Mostrar, ocultar, mover e redimensionar. Alt+↑/↓ também move o widget focado.", "relógio data busca atalhos favoritos abas sessões tarefas notas downloads foco calendário leitura performance");
    const list = element("div", "moon-widget-settings-list"); const ordered = [...config.home.widgets].sort((a, b) => a.order - b.order);
    ordered.forEach((widget, index) => { const row = element("div", "moon-widget-setting"); row.tabIndex = 0; row.setAttribute("aria-label", `${WIDGET_LABELS[widget.id]}, posição ${index + 1}, ${widget.columns} colunas`); const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", WIDGET_LABELS[widget.id]), element("small", "", `${widget.columns}/${config.home.columns} colunas · ${Math.round(widget.opacity * 100)}%`)); const visible = this.#toggle("Mostrar", widget.visible, value => this.#widget(widget.id, candidate => { candidate.visible = value; })); const opacity = element("input", "moon-widget-opacity"); opacity.type = "range"; opacity.min = ".2"; opacity.max = "1"; opacity.step = ".05"; opacity.value = String(widget.opacity); opacity.setAttribute("aria-label", `Opacidade de ${WIDGET_LABELS[widget.id]}`); opacity.addEventListener("input", () => this.#widget(widget.id, candidate => { candidate.opacity = Number(opacity.value); })); const narrow = button("moon-icon-button", `Diminuir ${WIDGET_LABELS[widget.id]}`, "back"); narrow.disabled = widget.columns === 1; narrow.addEventListener("click", () => this.#widget(widget.id, candidate => { candidate.columns = Math.max(1, candidate.columns - 1) as 1 | 2 | 3 | 4; }, true)); const wide = button("moon-icon-button", `Aumentar ${WIDGET_LABELS[widget.id]}`, "forward"); wide.disabled = widget.columns >= config.home.columns; wide.addEventListener("click", () => this.#widget(widget.id, candidate => { candidate.columns = Math.min(config.home.columns, candidate.columns + 1) as 1 | 2 | 3 | 4; }, true)); const up = button("moon-icon-button", `Mover ${WIDGET_LABELS[widget.id]} para cima`, "back"); up.disabled = index === 0; up.addEventListener("click", () => this.#moveWidget(widget.id, -1)); const down = button("moon-icon-button", `Mover ${WIDGET_LABELS[widget.id]} para baixo`, "forward"); down.disabled = index === ordered.length - 1; down.addEventListener("click", () => this.#moveWidget(widget.id, 1)); row.addEventListener("keydown", event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); this.#moveWidget(widget.id, event.key === "ArrowUp" ? -1 : 1); } }); row.append(element("span", "moon-order-grip", "⋮⋮"), copy, visible, opacity, narrow, wide, up, down); list.append(row); }); widgets.append(list);
    const shortcuts = this.#group("Atalhos personalizados", "Nome, URL HTTPS e destino são armazenados localmente; o ícone usa iniciais seguras.", "atalhos nome url nova aba atual excluir"); const shortcutForm = element("form", "moon-custom-provider-form"); const shortcutName = this.#bareInput("Nome", "Moon"); const shortcutUrl = this.#bareInput("URL HTTPS", "https://moon.example"); const target = element("select", "moon-select"); target.setAttribute("aria-label", "Destino do atalho"); target.append(option("current", "Aba atual"), option("new", "Nova aba")); const addShortcut = button("moon-primary-button", "Adicionar atalho personalizado", "plus"); addShortcut.type = "submit"; addShortcut.append(element("span", "", "Adicionar")); shortcutForm.append(shortcutName.wrapper, shortcutUrl.wrapper, target, addShortcut); shortcutForm.addEventListener("submit", event => { event.preventDefault(); const name = shortcutName.input.value.trim(); const rawUrl = shortcutUrl.input.value.trim(); let url: URL; try { url = new URL(rawUrl); } catch { return this.#error("URL do atalho inválida."); } if (!name || name.length > 80 || url.protocol !== "https:") return this.#error("Informe um nome e uma URL HTTPS."); this.options.onAddShortcut({ name, url: url.href, openIn: target.value as "current" | "new" }); this.#say("Atalho adicionado."); this.#render(); }); shortcuts.append(shortcutForm); for (const shortcut of this.options.shortcuts()) { const row = element("div", "moon-theme-row"); const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", shortcut.name), element("small", "", `${shortcut.url} · ${shortcut.openIn === "new" ? "nova aba" : "aba atual"}`)); const remove = button("moon-icon-button", `Excluir atalho ${shortcut.name}`, "trash"); remove.addEventListener("click", () => { this.options.onRemoveShortcut(shortcut.id); this.#render(); }); row.append(copy, remove); shortcuts.append(row); }
    this.#content.append(grid, widgets, shortcuts);
  }

  #typography(config: CustomizationConfig): void {
    this.#intro("Tipografia", "Escalas separadas sem alterar o zoom das páginas visitadas.");
    const rhythm = this.#group("Família e ritmo", "Família instalada com fallbacks; caracteres capazes de injetar CSS são rejeitados.", "tipografia fonte família tamanho escala peso line height spacing"); rhythm.append(this.#input("Família", config.typography.family, "text", value => this.#set("typography.family", value), "Inter, system-ui, sans-serif"), this.#rangeGrid([["Tamanho base", "typography.baseSize", config.typography.baseSize, 11, 22, 1], ["Escala", "typography.scale", config.typography.scale, .8, 1.4, .05], ["Peso", "typography.weight", config.typography.weight, 300, 800, 100], ["Altura de linha", "typography.lineHeight", config.typography.lineHeight, 1.1, 2, .05], ["Letter spacing", "typography.letterSpacing", config.typography.letterSpacing, -.05, .15, .01]]));
    const contexts = this.#group("Contextos", "Interface, omnibox, abas, Home e ícones têm escalas independentes.", "tipografia ui omnibox tabs home icon labels"); contexts.append(this.#rangeGrid([["Interface", "typography.uiSize", config.typography.uiSize, 9, 20, 1], ["Omnibox", "typography.omniboxSize", config.typography.omniboxSize, 10, 22, 1], ["Abas", "typography.tabSize", config.typography.tabSize, 9, 18, 1], ["Home", "typography.homeSize", config.typography.homeSize, 12, 28, 1], ["Ícones", "typography.iconScale", config.typography.iconScale, .75, 1.5, .05]]), this.#toggle("Mostrar labels", config.typography.labels, value => this.#set("typography.labels", value)));
    this.#content.append(rhythm, contexts);
  }

  #searchPage(config: CustomizationConfig): void {
    this.#intro("Pesquisa", "DuckDuckGo, Google, Brave e Bing prontos, além de templates HTTPS.");
    const engines = this.#group("Buscador padrão", "Keywords trocam temporariamente o provedor: por exemplo, “g: moon browser”.", "duckduckgo google brave bing keyword omnibox"); engines.append(this.#select("Padrão", config.search.defaultEngine, config.search.providers.map(provider => [provider.id, provider.name]), value => this.#set("search.defaultEngine", value)));
    for (const provider of config.search.providers) { const row = element("article", "moon-search-provider-row"); const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", provider.name), element("small", "", `${provider.keyword ? `${provider.keyword}: ` : ""}${provider.template}`)); row.append(copy); if (!["duckduckgo", "google", "brave", "bing"].includes(provider.id)) { const remove = button("moon-icon-button", `Excluir ${provider.name}`, "trash"); remove.addEventListener("click", () => { this.options.store.update(next => { (next.search as { providers: readonly SearchProvider[] }).providers = next.search.providers.filter(candidate => candidate.id !== provider.id); if (next.search.defaultEngine === provider.id) (next.search as { defaultEngine: string }).defaultEngine = "duckduckgo"; }); this.#render(); }); row.append(remove); } engines.append(row); }
    const custom = this.#group("Buscador customizado", "O template deve usar HTTPS e conter {query}.", "adicionar id nome template url keyword"); const form = element("form", "moon-custom-provider-form"); const id = this.#bareInput("ID", "meu-buscador"); const name = this.#bareInput("Nome", "Meu buscador"); const template = this.#bareInput("Template", "https://example.com/?q={query}"); const keyword = this.#bareInput("Keyword", "m"); const add = button("moon-primary-button", "Adicionar buscador", "plus"); add.type = "submit"; add.append(element("span", "", "Adicionar")); form.append(id.wrapper, name.wrapper, template.wrapper, keyword.wrapper, add); form.addEventListener("submit", event => { event.preventDefault(); const accepted = this.options.store.update(next => { (next.search as { providers: readonly SearchProvider[] }).providers = [...next.search.providers, { id: id.input.value.trim(), name: name.input.value.trim(), template: template.input.value.trim(), ...(keyword.input.value.trim() ? { keyword: keyword.input.value.trim() } : {}) }]; }); this.#result(accepted); if (accepted) this.#render(); }); custom.append(form);
    this.#content.append(engines, custom);
  }

  #data(config: CustomizationConfig): void {
    this.#intro("Workspaces e dados", "Escopo global ou por workspace, JSON V3 validado e recuperação segura.");
    const portability = this.#group("Portabilidade", "Exporte apenas aparência, o workspace atual ou tudo. Cookies e senhas nunca entram no arquivo.", "importar exportar json aparência workspace tudo preview"); const actions = element("div", "moon-portability-grid");
    for (const [scope, label] of [["appearance", "Exportar aparência"], ["workspace", "Exportar workspace"], ["all", "Exportar tudo"]] as const) { const action = button("moon-secondary-button", label, "download"); action.append(element("span", "", label)); action.addEventListener("click", () => void this.#export(scope)); actions.append(action); }
    const importButton = button("moon-primary-button", "Importar personalização", "folder"); importButton.append(element("span", "", "Importar JSON")); importButton.addEventListener("click", () => void this.#import()); actions.append(importButton); portability.append(actions);
    const favicons = this.#group("Favicons e privacidade", "Símbolos são baixados pelo processo seguro, limitados a 250 KB e nunca carregados diretamente na UI.", "favicons símbolos cache privacidade validade ttl"); favicons.append(this.#toggle("Exibir favicons", config.favicons.enabled, value => this.#set("favicons.enabled", value)), this.#toggle("Persistir cache local", config.favicons.persist, value => this.#set("favicons.persist", value)), this.#range("Validade em dias", "favicons.ttlDays", config.favicons.ttlDays, 1, 365, 1));
    const reset = this.#group("Reset e recuperação", "Recupere a interface antes de considerar o reset total.", "reset backup último estado válido restaurar modo seguro diagnóstico"); const resetActions = element("div", "moon-settings-actions");
    const safe = button("moon-secondary-button", "Iniciar configurações em modo seguro", "shield"); safe.append(element("span", "", "Modo seguro")); safe.addEventListener("click", () => { this.#result(this.options.store.startSafeMode()); this.#render(); });
    const restore = button("moon-secondary-button", "Restaurar último estado funcional", "back"); restore.append(element("span", "", "Último estado funcional")); restore.addEventListener("click", () => { this.#result(this.options.store.restoreLastKnownGood()); this.#render(); });
    const diagnostic = button("moon-secondary-button", "Exportar diagnóstico e backup", "download"); diagnostic.append(element("span", "", "Exportar diagnóstico")); diagnostic.addEventListener("click", () => void this.#exportDiagnostic());
    const current = button("moon-secondary-button", "Restaurar escopo atual", "reload"); current.append(element("span", "", "Restaurar este escopo")); current.addEventListener("click", () => { if (confirm("Restaurar o escopo atual? O preview atual será substituído.")) { this.options.store.resetAll("current"); this.#render(); } });
    const all = button("moon-danger-button", "Reset total", "trash"); all.append(element("span", "", "Reset total")); all.addEventListener("click", () => { if (confirm("Reset total remove personalizações e temas salvos. Exporte um backup antes de continuar. Prosseguir?")) { this.options.store.resetAll("everything"); this.#render(); } }); resetActions.append(safe, restore, diagnostic, current, all); reset.append(resetActions, element("p", "moon-recovery-note", this.options.store.loadResult.message ?? "O último estado válido é atualizado apenas quando você confirma as mudanças."));
    this.#content.append(this.#importControls(), portability, favicons, reset);
  }

  #importControls(): HTMLElement {
    const group = this.#group("Importação segura", "Detecta perfis compatíveis sem modificá-los. Cookies, sessões, carteiras, extensões e senhas não são copiados.", "importar chrome chromium brave vivaldi edge firefox favoritos histórico bookmarks html staging rollback");
    const actions = element("div", "moon-settings-actions");
    const scan = button("moon-primary-button", "Detectar perfis instalados", "search"); scan.append(element("span", "", "Detectar perfis")); scan.addEventListener("click", () => { void this.#discoverImportSources(); });
    const html = button("moon-secondary-button", "Importar favoritos de arquivo HTML", "download"); html.append(element("span", "", "Bookmarks HTML")); html.addEventListener("click", () => { void this.#importBookmarksHtml(); }); actions.append(scan, html); group.append(actions);
    if (!this.#importSources.length) { group.append(element("p", "moon-widget-empty", "Nenhum perfil analisado nesta sessão. A detecção é local e somente leitura.")); return group; }
    const list = element("div", "moon-import-source-list");
    for (const source of this.#importSources) {
      const row = element("article", "moon-import-source"); const copy = element("span", "moon-list-copy");
      copy.append(element("strong", "", source.name), element("small", "", `Atualizado ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(source.modifiedAt)}`));
      const categories = element("div", "moon-import-categories"); const selected = new Map<ImportCategory, HTMLInputElement>();
      for (const category of ["bookmarks", "history"] as const) { const count = source.categories[category]; const label = element("label", "moon-import-category"); const input = element("input"); input.type = "checkbox"; input.checked = count > 0; input.disabled = count === 0; selected.set(category, input); label.append(input, element("span", "", `${category === "bookmarks" ? "Favoritos" : "Histórico"} (${count})`)); categories.append(label); }
      const run = button("moon-primary-button", `Importar de ${source.name}`, "download"); run.append(element("span", "", "Importar seleção")); run.addEventListener("click", () => { const values = [...selected].filter(([, input]) => input.checked).map(([category]) => category); if (!values.length) return this.#error("Selecione ao menos uma categoria."); void this.#runBrowserImport(source.id, values); });
      row.append(copy, categories, run); list.append(row);
    }
    group.append(list); return group;
  }

  #intro(title: string, description: string): void { const intro = element("header", "moon-settings-page-intro"); intro.append(element("h1", "", title), element("p", "", description), element("span", "moon-scope-badge", this.options.store.document.scope === "global" ? "Global" : this.options.workspaceName)); this.#content.append(intro); }
  #group(title: string, description: string, terms: string): HTMLElement { const group = element("section", "moon-setting-group"); group.dataset.search = `${title} ${description} ${terms}`.toLocaleLowerCase("pt-BR"); const header = element("header", "moon-setting-group-header"); const copy = element("div"); copy.append(element("h3", "", title), element("p", "", description)); const reset = button("moon-group-reset", `Restaurar ${title}`, "reload"); reset.append(element("span", "", "Resetar grupo")); if (this.#canResetGroup(title)) reset.addEventListener("click", () => { this.#resetGroup(title); this.#say(`${title} restaurado.`); this.#render(); }); else reset.hidden = true; header.append(copy, reset); group.append(header); return group; }
  #canResetGroup(title: string): boolean { return !["Posição das abas", "Temas completos", "Atalhos personalizados", "Buscador customizado", "Portabilidade", "Reset e recuperação"].includes(title); }
  #resetGroup(title: string): void { this.options.store.update(next => { const defaults = clone(DEFAULT_CUSTOMIZATION); if (title === "Modo e agenda") { (next.appearance as Mutable<typeof next.appearance>).mode = defaults.appearance.mode; (next.appearance as Mutable<typeof next.appearance>).schedule = defaults.appearance.schedule; } else if (title === "Editor livre de cores") (next.appearance as Mutable<typeof next.appearance>).colors = defaults.appearance.colors; else if (title === "Wallpaper e filtros") (next.appearance as Mutable<typeof next.appearance>).wallpaper = defaults.appearance.wallpaper; else if (title === "Vidro, superfícies e movimento") { const value = next.appearance as Mutable<typeof next.appearance>; value.glass = defaults.appearance.glass; value.opacity = defaults.appearance.opacity; value.shape = defaults.appearance.shape; value.motion = defaults.appearance.motion; } else if (title === "Densidade e escala") { (next.layout as Mutable<typeof next.layout>).density = defaults.layout.density; (next.layout as Mutable<typeof next.layout>).uiScale = defaults.layout.uiScale; } else if (title === "Sidebar e drawers") { (next.layout as Mutable<typeof next.layout>).sidebar = defaults.layout.sidebar; (next.layout as Mutable<typeof next.layout>).drawer = defaults.layout.drawer; } else if (title === "Workspaces") (next as Mutable<typeof next>).workspaceDisplay = defaults.workspaceDisplay; else if (title === "Toolbar e omnibox") { (next.layout as Mutable<typeof next.layout>).toolbar = defaults.layout.toolbar; (next.layout as Mutable<typeof next.layout>).omnibox = defaults.layout.omnibox; } else if (title === "Barra de status") (next.layout as Mutable<typeof next.layout>).statusBar = defaults.layout.statusBar; else if (title === "Preset e grid") { const home = next.home as Mutable<typeof next.home>; home.preset = defaults.home.preset; home.columns = defaults.home.columns; home.gap = defaults.home.gap; home.maxWidth = defaults.home.maxWidth; home.horizontalAlign = defaults.home.horizontalAlign; home.verticalAlign = defaults.home.verticalAlign; home.padding = defaults.home.padding; home.cardStyle = defaults.home.cardStyle; home.greeting = defaults.home.greeting; } else if (title === "Widgets") (next.home as Mutable<typeof next.home>).widgets = defaults.home.widgets; else if (title === "Família e ritmo" || title === "Contextos") (next as Mutable<typeof next>).typography = defaults.typography; else if (title === "Buscador padrão") (next as Mutable<typeof next>).search = defaults.search; else if (title === "Favicons e privacidade") (next as Mutable<typeof next>).favicons = defaults.favicons; }); }
  #select(label: string, value: string, options: readonly SelectOption[], change: (value: string) => void): HTMLElement { const field = element("label", "moon-field"); field.append(element("span", "", label)); const select = element("select", "moon-select"); options.forEach(([id, name]) => select.add(option(id, name))); select.value = value; select.addEventListener("change", () => change(select.value)); field.append(select); return field; }
  #input(label: string, value: string, type: string, change: (value: string) => boolean | void, placeholder = ""): HTMLElement { const field = element("label", "moon-field"); field.append(element("span", "", label)); const input = element("input", "moon-settings-input"); input.type = type; input.value = value; input.placeholder = placeholder; input.addEventListener("change", () => { const accepted = change(input.value); if (accepted === false) input.value = value; }); field.append(input); return field; }
  #bareInput(label: string, placeholder: string): { wrapper: HTMLElement; input: HTMLInputElement } { const wrapper = element("label", "moon-field"); wrapper.append(element("span", "", label)); const input = element("input", "moon-settings-input"); input.placeholder = placeholder; wrapper.append(input); return { wrapper, input }; }
  #toggle(label: string, checked: boolean, change: (value: boolean) => void): HTMLElement { const row = element("label", "moon-toggle-row"); const input = element("input"); input.type = "checkbox"; input.checked = checked; input.addEventListener("change", () => change(input.checked)); row.append(element("span", "", label), input, element("span", "moon-toggle-control")); return row; }
  #color(label: string, value: string, change: (value: string) => void): HTMLElement { const field = element("label", "moon-color-field"); field.append(element("span", "", label)); const wrap = element("span", "moon-color-control"); const picker = element("input"); picker.type = "color"; picker.value = value; picker.setAttribute("aria-label", `${label}: seletor`); const input = element("input", "moon-settings-input"); input.value = value; input.setAttribute("aria-label", `${label}: HEX`); picker.addEventListener("input", () => { input.value = picker.value; change(picker.value); }); input.addEventListener("change", () => { const accepted = this.#setFrom(change, input.value); if (!accepted) input.value = value; else picker.value = input.value; }); wrap.append(picker, input); field.append(wrap); return field; }
  #range(label: string, path: string, value: number, min: number, max: number, step: number, home = false): HTMLElement { const field = element("label", "moon-range-field"); const heading = element("span", "moon-range-heading"); const output = element("output", "", format(value)); heading.append(element("span", "", label), output); const input = element("input"); input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value); input.addEventListener("input", () => { output.value = format(Number(input.value)); if (home) this.#homeSet(path, Number(input.value)); else this.#set(path, Number(input.value)); }); field.append(heading, input); return field; }
  #rangeGrid(values: readonly (readonly [string, string, number, number, number, number])[], home = false): HTMLElement { const grid = element("div", "moon-range-grid"); values.forEach(value => grid.append(this.#range(...value, home))); return grid; }
  #file(): HTMLElement { const field = element("label", "moon-field"); field.append(element("span", "", "Arquivo local (PNG/JPEG/WebP/GIF até 1,5 MB)")); const input = element("input", "moon-settings-input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp,image/gif"; input.addEventListener("change", () => { const file = input.files?.[0]; if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 1_500_000) return this.#error("Use PNG, JPEG, WebP ou GIF de até 1,5 MB."); const reader = new FileReader(); reader.addEventListener("load", () => { if (typeof reader.result !== "string") return; const accepted = this.options.store.update(next => { const wallpaper = next.appearance.wallpaper as Mutable<typeof next.appearance.wallpaper>; wallpaper.type = file.type === "image/gif" ? "animated" : "local"; wallpaper.source = reader.result as string; }); this.#result(accepted); if (accepted) this.#render(); }); reader.readAsDataURL(file); }); field.append(input); return field; }
  #paletteFile(): HTMLElement { const field = element("label", "moon-field"); field.append(element("span", "", "Extrair paleta de imagem local (opcional)")); const input = element("input", "moon-settings-input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.addEventListener("change", () => { const file = input.files?.[0]; if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_500_000) return this.#error("Use PNG, JPEG ou WebP de até 1,5 MB para extrair a paleta."); const source = URL.createObjectURL(file); const image = new Image(); image.addEventListener("load", () => { try { const scale = Math.min(1, 64 / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Canvas indisponível para extrair a paleta."); context.drawImage(image, 0, 0, canvas.width, canvas.height); const palette = extractPalette(context.getImageData(0, 0, canvas.width, canvas.height)); const accepted = this.options.store.update(next => { Object.assign(next.appearance.colors as Mutable<typeof next.appearance.colors>, palette.colors); Object.assign(next.appearance.regions as Mutable<typeof next.appearance.regions>, palette.regions); }); this.#result(accepted); if (accepted) { this.#say("Paleta local extraída e aplicada ao preview."); this.#render(); } } catch (error) { this.#error(error); } finally { URL.revokeObjectURL(source); } }); image.addEventListener("error", () => { URL.revokeObjectURL(source); this.#error("Não foi possível decodificar a imagem local."); }); image.src = source; }); field.append(input); return field; }
  #set(path: string, value: unknown): boolean { const accepted = this.options.store.set(path, value); this.#result(accepted); return accepted; }
  #homeSet(path: string, value: unknown): boolean { const accepted = this.options.store.update(next => { setPath(next, path, value); (next.home as Mutable<typeof next.home>).preset = "custom"; }); this.#result(accepted); return accepted; }
  #setFrom(change: (value: string) => void, value: string): boolean { change(value); const accepted = !this.options.store.lastError; this.#result(accepted); return accepted; }
  #result(accepted: boolean): void { this.#undo.disabled = !this.options.store.canUndo; this.#redo.disabled = !this.options.store.canRedo; if (accepted) { this.#message.textContent = "Alteração aplicada ao preview; confirme para salvar."; this.#message.classList.remove("is-error"); } else this.#error(this.options.store.lastError ?? "Valor inválido."); }
  #syncPreviewState(): void { this.#preview.element.hidden = this.#previewCollapsed; this.#previewToggle.title = this.#previewCollapsed ? "Expandir prévia" : "Recolher prévia"; this.#previewToggle.setAttribute("aria-expanded", String(!this.#previewCollapsed)); }
  #wallpaperType(value: string): void { const defaults: Readonly<Record<string, string>> = { local: WALLPAPER_PRESETS[0].source, animated: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", https: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986", color: "#10131b", gradient: "linear-gradient(135deg, #17102d, #071827)" }; this.options.store.update(next => { const wallpaper = next.appearance.wallpaper as Mutable<typeof next.appearance.wallpaper>; wallpaper.type = value as typeof wallpaper.type; wallpaper.source = defaults[value]!; wallpaper.cachedData = undefined; }); this.#render(); if (value === "https") void this.#wallpaperSource(defaults[value]!); }
  async #wallpaperSource(url: string): Promise<void> { try { this.#say("Baixando e validando wallpaper HTTPS…"); const cachedData = await this.options.onFetchWallpaper(url); const accepted = this.options.store.update(next => { const wallpaper = next.appearance.wallpaper as Mutable<typeof next.appearance.wallpaper>; wallpaper.type = "https"; wallpaper.source = url; wallpaper.cachedData = cachedData; }); this.#result(accepted); if (accepted) { this.#say("Wallpaper HTTPS validado e armazenado localmente."); this.#render(); } } catch (error) { this.#error(error); } }
  #density(value: string): void { const accepted = this.options.store.update(next => { const layout = next.layout as Mutable<typeof next.layout>; layout.density = value as typeof layout.density; if (value === "compact") { layout.uiScale = .9; (layout.toolbar as { height: number }).height = 42; } if (value === "comfortable") { layout.uiScale = 1; (layout.toolbar as { height: number }).height = 50; } if (value === "touch") { layout.uiScale = 1.15; (layout.toolbar as { height: number }).height = 62; } }); this.#result(accepted); this.#render(); }
  #moveToolbar(index: number, direction: -1 | 1): void { this.options.store.update(next => { const items = next.layout.toolbar.items as Mutable<typeof next.layout.toolbar.items>; const target = index + direction; if (target >= 0 && target < items.length) [items[index], items[target]] = [items[target]!, items[index]!]; }); this.#say(`Item movido para a posição ${index + direction + 1}.`); this.#render(); }
  #widget(id: HomeWidgetId, mutate: (widget: { visible: boolean; columns: 1 | 2 | 3 | 4; opacity: number }) => void, render = false): void { const accepted = this.options.store.update(next => { const widget = next.home.widgets.find(candidate => candidate.id === id); if (widget) mutate(widget as { visible: boolean; columns: 1 | 2 | 3 | 4; opacity: number }); (next.home as Mutable<typeof next.home>).preset = "custom"; }); this.#result(accepted); if (render) this.#render(); }
  #moveWidget(id: HomeWidgetId, direction: -1 | 1): void { this.options.store.update(next => { const widgets = [...next.home.widgets].sort((a, b) => a.order - b.order); const index = widgets.findIndex(widget => widget.id === id); const target = index + direction; if (index >= 0 && target >= 0 && target < widgets.length) { [widgets[index], widgets[target]] = [widgets[target]!, widgets[index]!]; widgets.forEach((widget, order) => (widget as { order: number }).order = order); const home = next.home as unknown as { widgets: typeof widgets; preset: HomePreset }; home.widgets = widgets; home.preset = "custom"; } }); this.#say(`${WIDGET_LABELS[id]} movido.`); this.#render(); }
  #homePreset(preset: HomePreset): void { this.options.store.update(next => { if (preset === "custom") (next.home as { preset: HomePreset }).preset = preset; else applyHomePreset(next.home, preset); }); this.#render(); }
  async #export(scope: "appearance" | "workspace" | "all"): Promise<void> { try { const saved = await this.options.onExport(this.options.store.export(scope)); this.#say(saved ? "Personalização exportada." : "Exportação cancelada."); } catch (error) { this.#error(error); } }
  async #exportDiagnostic(): Promise<void> { try { const saved = await this.options.onExportDiagnostic(this.options.store.diagnostic()); this.#say(saved ? "Diagnóstico sanitizado exportado." : "Exportação cancelada."); } catch (error) { this.#error(error); } }
  async #import(): Promise<void> { try { const content = await this.options.onImport(); if (!content) return; if (!confirm("Importar esta personalização? Você ainda pode cancelar o preview.")) return; this.options.store.import(content); this.#say("Importação validada e aplicada ao preview."); this.#render(); } catch (error) { this.#error(error); } }
  async #discoverImportSources(): Promise<void> { try { this.#say("Analisando perfis locais em modo somente leitura…"); this.#importSources = await this.options.onDiscoverImportSources(); this.#say(this.#importSources.length ? `${this.#importSources.length} perfil(is) compatível(is) encontrado(s).` : "Nenhum perfil compatível com dados importáveis foi encontrado."); this.#render(); } catch (error) { this.#error(error); } }
  async #runBrowserImport(sourceId: string, categories: readonly ImportCategory[]): Promise<void> { try { this.#say("Importando a partir de staging validado…"); const result = await this.options.onImportBrowserProfile(sourceId, categories); this.#say(`Importação concluída: ${result.imported.bookmarks} favoritos e ${result.imported.history} itens de histórico; ${result.skipped.bookmarks + result.skipped.history} duplicados ignorados.`); } catch (error) { this.#error(error); } }
  async #importBookmarksHtml(): Promise<void> { try { const result = await this.options.onImportBookmarksHtml(); if (!result) return this.#say("Importação HTML cancelada."); this.#say(`HTML importado: ${result.imported.bookmarks} favoritos; ${result.skipped.bookmarks} duplicados ignorados.`); } catch (error) { this.#error(error); } }
  #themeCatalogRow(theme: ThemeCatalogEntry): HTMLElement {
    const row = element("article", `moon-theme-row moon-theme-${theme.source}${theme.active ? " is-active" : ""}`);
    const source = theme.source === "builtin" ? "Nativo" : theme.source === "user" ? "Criado por você" : theme.trust === "official" ? "Pacote oficial" : "Pacote local / não oficial";
    const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", theme.name), element("small", "", `${source} · ${theme.author} · ${theme.version}${theme.active ? " · Ativo no preview" : ""}`), element("small", "", theme.capabilities.join(" · ")));
    const apply = button("moon-text-button", `Aplicar ${theme.name}`, "palette"); apply.append(element("span", "", theme.active ? "Aplicado" : "Aplicar")); apply.disabled = theme.active; apply.addEventListener("click", () => void this.#applyCatalogTheme(theme));
    row.append(copy, apply);
    if (theme.source === "user") {
      const duplicate = button("moon-icon-button", `Duplicar ${theme.name}`, "plus"); duplicate.addEventListener("click", () => { const copyTheme = this.options.store.duplicateTheme(theme.id); this.#selectedThemeId = copyTheme.id; this.#render(); });
      const rename = button("moon-icon-button", `Renomear ${theme.name}`, "note"); rename.addEventListener("click", () => { const value = prompt("Novo nome", theme.name); if (value) { this.options.store.renameTheme(theme.id, value); this.#render(); } });
      const remove = button("moon-icon-button", `Excluir ${theme.name}`, "trash"); remove.addEventListener("click", () => { this.options.store.deleteTheme(theme.id); if (this.#selectedThemeId === theme.id) this.#selectedThemeId = undefined; this.#render(); });
      row.append(duplicate, rename, remove);
    } else if (theme.source === "moontheme") {
      const installed = this.#moonThemes.find(candidate => candidate.id === theme.id);
      if (installed) {
        const rollback = button("moon-icon-button", `Restaurar versão anterior de ${theme.name}`, "back"); rollback.addEventListener("click", () => void this.#rollbackMoonTheme(installed.packageId));
        const exportTheme = button("moon-icon-button", `Exportar ${theme.name}`, "download"); exportTheme.addEventListener("click", () => void this.#exportMoonTheme(theme.id));
        const remove = button("moon-icon-button", `Remover ${theme.name}`, "trash"); remove.addEventListener("click", () => void this.#removeMoonTheme(installed));
        row.append(rollback, exportTheme, remove);
      }
    }
    return row;
  }
  async #applyCatalogTheme(theme: ThemeCatalogEntry): Promise<void> {
    if (theme.source === "moontheme") return this.#applyMoonTheme(theme.id);
    const accepted = theme.source === "builtin" ? this.options.store.update(config => Object.assign(config, clone(DEFAULT_CUSTOMIZATION))) : (this.options.store.applyTheme(theme.id), true);
    this.#result(accepted); if (!accepted) return;
    this.#selectedThemeId = theme.id; this.#selectedMoonThemeId = undefined;
    this.#say("Tema aplicado ao preview. Confirme em Aplicar mudanças."); this.#render();
  }
  async #loadMoonThemes(): Promise<void> { try { this.#moonThemes = await this.options.onListMoonThemes(); this.#render(); } catch (error) { this.#error(error); } }
  async #importMoonTheme(): Promise<void> { try { const preview = await this.options.onImportMoonTheme(); if (!preview) return; this.#pendingMoonTheme = preview; this.#say("Pacote validado. Revise autoria, confiança e alterações antes de instalar."); this.#render(); } catch (error) { this.#error(error); } }
  async #cancelMoonTheme(): Promise<void> { const pending = this.#pendingMoonTheme; if (!pending) return; try { await this.options.onCancelMoonTheme(pending.intentId); this.#pendingMoonTheme = undefined; this.#say("Importação cancelada e quarentena removida."); this.#render(); } catch (error) { this.#error(error); } }
  async #confirmMoonTheme(): Promise<void> { const pending = this.#pendingMoonTheme; if (!pending) return; try { const installed = await this.options.onConfirmMoonTheme(pending.intentId); this.#pendingMoonTheme = undefined; await this.#applyMoonTheme(installed.id); this.#say("Moon Theme instalado e aplicado ao preview. Use Aplicar mudanças para confirmar."); } catch (error) { this.#error(error); } }
  async #applyMoonTheme(id: string): Promise<void> { try { const payload = await this.options.onApplyMoonTheme(id); const accepted = this.options.store.applyMoonTheme(payload.tokens, payload.wallpaperData); this.#result(accepted); if (!accepted) return; this.#applyIconData(payload.iconData); this.#selectedMoonThemeId = id; this.#selectedThemeId = id; this.#say("Tema aplicado ao preview. Confirme em Aplicar mudanças."); this.#render(); } catch (error) { this.#error(error); } }
  async #rollbackMoonTheme(packageId: string): Promise<void> { try { const payload = await this.options.onRollbackMoonTheme(packageId); const accepted = this.options.store.applyMoonTheme(payload.tokens, payload.wallpaperData); this.#result(accepted); if (accepted) { this.#applyIconData(payload.iconData); this.#selectedMoonThemeId = payload.summary.id; this.#selectedThemeId = payload.summary.id; this.#say("Versão anterior restaurada no preview. Confirme em Aplicar mudanças."); this.#render(); } } catch (error) { this.#error(error); } }
  #applyIconData(iconData?: Readonly<Partial<Record<"logo" | "newTab" | "privateTab", string>>>): void { clearIconOverrides(["moon", "plus", "shield"]); if (iconData) installIconOverrides({ ...(iconData.logo ? { moon: iconData.logo } : {}), ...(iconData.newTab ? { plus: iconData.newTab } : {}), ...(iconData.privateTab ? { shield: iconData.privateTab } : {}) }); }
  async #removeMoonTheme(theme: MoonThemeSummary): Promise<void> { if (!confirm(`Remover ${theme.name} ${theme.version}?`)) return; try { await this.options.onRemoveMoonTheme(theme.id); await this.#loadMoonThemes(); this.#say("Tema removido com segurança."); } catch (error) { this.#error(error); } }
  async #exportMoonTheme(id: string): Promise<void> { try { const exported = await this.options.onExportMoonTheme(id); this.#say(exported ? "Pacote .moontheme exportado." : "Exportação cancelada."); } catch (error) { this.#error(error); } }
  async #close(applied: boolean): Promise<void> {
    try {
      if (this.#pendingMoonTheme) { await this.options.onCancelMoonTheme(this.#pendingMoonTheme.intentId); this.#pendingMoonTheme = undefined; }
      if (applied && this.#selectedMoonThemeId) await this.options.onActivateMoonTheme(this.#selectedMoonThemeId);
      if (applied && !await this.options.store.applyPreview()) {
        this.#error(new Error(this.options.store.lastError ?? "Não foi possível salvar a personalização."));
        return;
      }
      if (!applied) { this.options.store.cancelPreview(); if (this.#selectedMoonThemeId) clearIconOverrides(["moon", "plus", "shield"]); }
      await this.options.onClose(applied);
    } catch (error) { this.#error(error); }
  }
  #filter(): void { const query = this.#search.value.trim().toLocaleLowerCase("pt-BR"); let shown = 0; this.#content.querySelectorAll<HTMLElement>(".moon-setting-group").forEach(group => { const match = !query || group.dataset.search?.includes(query); group.hidden = !match; if (match) shown += 1; }); this.#content.querySelector(".moon-settings-no-results")?.remove(); if (query && shown === 0) this.#content.append(element("div", "moon-settings-no-results", `Nenhuma configuração encontrada para “${this.#search.value}”.`)); }
  #keys(event: KeyboardEvent): void { if (event.key === "Escape") { event.preventDefault(); void this.#close(false); return; } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) this.options.store.redo(); else this.options.store.undo(); this.#render(); return; } if (event.key !== "Tab") return; const focusable = [...this.#modal.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => !node.hidden); const first = focusable[0]; const last = focusable.at(-1); if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); } }
  #say(message: string): void { this.#message.textContent = message; this.#message.classList.remove("is-error"); this.#live.textContent = ""; requestAnimationFrame(() => { this.#live.textContent = message; }); }
  #error(error: unknown): void { const message = error instanceof Error ? error.message : String(error); this.#message.textContent = message; this.#message.classList.add("is-error"); this.#live.textContent = `Erro: ${message}`; }
}

function setPath(target: object, path: string, value: unknown): void { const parts = path.split("."); let cursor = target as Record<string, unknown>; for (const part of parts.slice(0, -1)) cursor = cursor[part] as Record<string, unknown>; cursor[parts.at(-1)!] = value; }
function format(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }
function option(value: string, label: string): HTMLOptionElement { const node = document.createElement("option"); node.value = value; node.textContent = label; return node; }
