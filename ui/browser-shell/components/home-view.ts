import type { CustomizationConfig, HomeWidgetId, WallpaperSettings } from "../../customization/customization-schema.js";
import type { ManagedDownload, SavedLink, Shortcut, Tab, Workspace } from "../contracts.js";
import { button, element, icon } from "../dom.js";

const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
  { id: "github", name: "GitHub", url: "https://github.com" }, { id: "youtube", name: "YouTube", url: "https://youtube.com" },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com" }, { id: "whatsapp", name: "WhatsApp", url: "https://web.whatsapp.com" }
];

export interface HomeRuntimeData {
  readonly shortcuts: readonly Shortcut[];
  readonly bookmarks: readonly SavedLink[];
  readonly tabs: readonly Tab[];
  readonly workspaces: readonly Workspace[];
  readonly downloads: readonly ManagedDownload[];
  readonly notes: string;
  readonly favicons: Readonly<Record<string, string>>;
}

export class HomeView {
  readonly element = element("main", "moon-home");
  readonly #wallpaper = element("div", "moon-home-wallpaper");
  readonly #grid = element("div", "moon-home-grid");
  #config: CustomizationConfig | undefined;
  #data: HomeRuntimeData = { shortcuts: [], bookmarks: [], tabs: [], workspaces: [], downloads: [], notes: "", favicons: {} };
  #clockTimer: number | undefined;

  constructor(readonly onNavigate: (value: string) => void, readonly onOpenNew: (value: string) => void = onNavigate, readonly onOpenFocus: () => void = () => undefined) { this.element.append(this.#wallpaper, this.#grid); }

  apply(config: CustomizationConfig): void { this.#config = config; this.#applyWallpaper(config.appearance.wallpaper); this.#render(); }
  updateData(data: HomeRuntimeData): void { this.#data = data; this.#render(); }
  focusSearch(): void { this.#grid.querySelector<HTMLInputElement>(".moon-home-search-input")?.focus(); }
  startClock(): void { this.#clockTimer = window.setInterval(() => this.#updateTimes(), 30_000); this.#updateTimes(); }
  dispose(): void { if (this.#clockTimer !== undefined) window.clearInterval(this.#clockTimer); }

  #render(): void {
    if (!this.#config) return;
    const { home } = this.#config; this.element.dataset.cardStyle = home.cardStyle; this.element.dataset.preset = home.preset;
    this.#grid.style.justifySelf = home.horizontalAlign; this.#grid.style.alignSelf = home.verticalAlign;
    const widgets = [...home.widgets].filter(widget => widget.visible).sort((a, b) => a.order - b.order);
    const fragment = document.createDocumentFragment();
    for (const state of widgets) {
      const widget = this.#widget(state.id); widget.classList.add("moon-home-widget"); widget.dataset.widget = state.id;
      widget.style.setProperty("--moon-widget-columns", String(Math.min(home.columns, state.columns))); widget.style.setProperty("--moon-widget-opacity", String(state.opacity));
      fragment.append(widget);
    }
    this.#grid.replaceChildren(fragment); this.#updateTimes();
  }

  #widget(id: HomeWidgetId): HTMLElement {
    if (id === "clock") return element("time", "moon-home-clock");
    if (id === "date") return element("time", "moon-home-date");
    if (id === "greeting") { const section = this.#card("moon-home-greeting-widget", "Moon"); const identity = element("div", "moon-home-identity"); identity.append(icon("moon", "moon-home-logo"), element("strong", "", "Moon")); section.append(identity, element("p", "moon-home-greeting", this.#config?.home.greeting ?? "")); return section; }
    if (id === "search") return this.#search();
    if (id === "shortcuts") return this.#shortcuts();
    if (id === "favorites") return this.#links("Favoritos", this.#data.bookmarks.slice(0, 8), "Nenhum favorito salvo.");
    if (id === "recentTabs") return this.#links("Abas recentes", this.#data.tabs.filter(tab => tab.url.startsWith("http")).slice(-8).reverse().map(tab => ({ id: tab.id, title: tab.title, url: tab.url, time: 0 })), "Nenhuma aba da web aberta.");
    if (id === "sessions") return this.#sessions();
    if (id === "notes") { const card = this.#card("", "Notas"); card.append(element("p", "moon-widget-copy", this.#data.notes.trim() || "Nenhuma anotação local.")); return card; }
    if (id === "downloads") return this.#downloads();
    if (id === "focus") return this.#focus();
    if (id === "performance") return this.#performance();
    const empty: Readonly<Record<"tasks" | "calendar" | "reading", readonly [string, string]>> = { tasks: ["Tarefas", "Nenhuma tarefa local."], calendar: ["Calendário", "Nenhum calendário conectado."], reading: ["Leitura", "Nenhum item na lista de leitura."] };
    const [title, description] = empty[id as keyof typeof empty] ?? ["Widget", "Sem dados disponíveis."]; const card = this.#card("", title); card.append(element("p", "moon-widget-empty", description)); return card;
  }

  #search(): HTMLElement {
    const form = element("form", "moon-home-search"); const input = element("input", "moon-home-search-input"); input.type = "search"; input.placeholder = "Pesquisar ou digitar endereço"; input.setAttribute("aria-label", input.placeholder);
    const submit = button("moon-home-search-button", "Pesquisar", "search"); submit.type = "submit"; form.append(icon("search"), input, element("kbd", "moon-shortcut", "Ctrl K"), submit); form.addEventListener("submit", event => { event.preventDefault(); const value = input.value.trim(); if (value) this.onNavigate(value); }); return form;
  }

  #shortcuts(): HTMLElement {
    const card = this.#card("moon-shortcuts-card", "Atalhos"); const grid = element("div", "moon-home-shortcuts");
    for (const item of [...DEFAULT_SHORTCUTS, ...this.#data.shortcuts]) { const shortcut = button("moon-shortcut-button", item.name); shortcut.append(this.#siteMark(item.url, item.name.slice(0, 2).toUpperCase(), "moon-shortcut-mark"), element("span", "moon-shortcut-label", item.name)); shortcut.addEventListener("click", () => item.openIn === "new" ? this.onOpenNew(item.url) : this.onNavigate(item.url)); grid.append(shortcut); }
    card.append(grid); return card;
  }

  #links(title: string, links: readonly SavedLink[], empty: string): HTMLElement {
    const card = this.#card("", title); if (!links.length) { card.append(element("p", "moon-widget-empty", empty)); return card; }
    const list = element("div", "moon-home-link-list"); links.forEach(link => { const item = button("moon-home-link", `Abrir ${link.title || link.url}`); const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", link.title || hostname(link.url)), element("small", "", hostname(link.url))); item.append(this.#siteMark(link.url, hostname(link.url).slice(0, 1).toUpperCase()), copy); item.addEventListener("click", () => this.onNavigate(link.url)); list.append(item); }); card.append(list); return card;
  }

  #sessions(): HTMLElement {
    const card = this.#card("", "Workspaces"); const list = element("div", "moon-widget-metrics");
    this.#data.workspaces.forEach(workspace => { const count = this.#data.tabs.filter(tab => (tab.workspaceId ?? "research") === workspace.id).length; const row = element("div", "moon-widget-metric"); row.append(element("strong", "", workspace.name), element("span", "", `${count} ${count === 1 ? "aba" : "abas"}`)); list.append(row); }); card.append(list); return card;
  }

  #downloads(): HTMLElement {
    const card = this.#card("", "Downloads"); const items = this.#data.downloads.slice(0, 5); if (!items.length) { card.append(element("p", "moon-widget-empty", "Nenhum download nesta sessão.")); return card; }
    const list = element("div", "moon-widget-metrics"); items.forEach(download => { const row = element("div", "moon-widget-metric"); row.append(element("strong", "", download.filename), element("span", "", download.state === "in-progress" ? `${Math.round(download.percentage ?? 0)}%` : download.state)); list.append(row); }); card.append(list); return card;
  }

  #focus(): HTMLElement {
    const card = this.#card("", "Foco"); card.append(element("p", "moon-widget-copy", "Sessões temporizadas, Pomodoro ou contínuas com Zen reversível.")); const action = button("moon-primary-button", "Configurar sessão de foco", "play"); action.append(element("span", "", "Abrir Foco")); action.addEventListener("click", this.onOpenFocus); card.append(action); return card;
  }

  #performance(): HTMLElement { const card = this.#card("", "Performance"); const list = element("div", "moon-widget-metrics"); const values = [["Abas", String(this.#data.tabs.length)], ["Núcleos lógicos", String(navigator.hardwareConcurrency || "—")], ["Downloads ativos", String(this.#data.downloads.filter(item => item.state === "in-progress").length)]]; values.forEach(([label, value]) => { const row = element("div", "moon-widget-metric"); row.append(element("span", "", label), element("strong", "", value)); list.append(row); }); card.append(list); return card; }

  #siteMark(url: string, fallback: string, className = "moon-site-mark"): HTMLElement {
    const mark = element("span", className); const source = this.#data.favicons[origin(url)];
    if (source) { const image = document.createElement("img"); image.src = source; image.alt = ""; image.draggable = false; mark.append(image); } else mark.textContent = fallback;
    return mark;
  }

  #card(className: string, title: string): HTMLElement { const card = element("section", `moon-home-card ${className}`.trim()); if (title) card.append(element("h2", "moon-widget-title", title)); return card; }
  #updateTimes(): void { const now = new Date(); this.#grid.querySelectorAll<HTMLTimeElement>('[data-widget="clock"]').forEach(node => { node.dateTime = now.toISOString(); node.textContent = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(now); }); this.#grid.querySelectorAll<HTMLTimeElement>('[data-widget="date"]').forEach(node => { node.dateTime = now.toISOString().slice(0, 10); node.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(now); }); }
  #applyWallpaper(settings: WallpaperSettings): void { const imageSource = settings.type === "https" ? settings.cachedData : settings.source; this.#wallpaper.style.backgroundImage = settings.type === "color" ? "none" : settings.type === "gradient" ? settings.source : imageSource ? `url(${JSON.stringify(imageSource)})` : "none"; this.#wallpaper.style.backgroundColor = settings.type === "color" ? settings.source : ""; this.#wallpaper.style.backgroundSize = settings.fit; this.#wallpaper.style.backgroundPosition = settings.position; this.#wallpaper.style.backgroundRepeat = settings.repeat ? "repeat" : "no-repeat"; }
}

function hostname(url: string): string { try { return new URL(url).hostname; } catch { return url; } }
function origin(url: string): string { try { return new URL(url).origin; } catch { return url; } }
