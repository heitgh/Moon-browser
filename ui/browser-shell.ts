import { MoonApp } from "./app/app.js";
import { resolveNavigationInput } from "./browser/navigation-input.js";
import {
  moonBrowserBridge,
  type AdblockStatus,
  type Drawer,
  type ManagedDownload,
  type Navigation,
  type LocalProfileAvatar,
  type LocalProfileSummary,
  type ProfileDataMutation,
  type ProfileDataSnapshot,
  type SavedLink,
  type SavedTheme,
  type SitePermissionRecord,
  type Shortcut,
  type Tab,
  type TabUpdate,
  type Workspace
} from "./browser-shell/contracts.js";
import {
  DEFAULT_WORKSPACES as WORKSPACES,
  loadProfileValue as load,
  PROFILE_KEYS as KEYS,
  saveProfileValue as save
} from "./browser-shell/profile.js";
import {
  button as btn,
  clearIconOverrides,
  element as el,
  icon as svg,
  installIconOverrides,
  type IconName
} from "./browser-shell/dom.js";
import { HomeView } from "./browser-shell/components/home-view.js";
import { TabStrip } from "./browser-shell/components/tab-strip.js";
import { WorkspaceBar } from "./browser-shell/components/workspace-bar.js";
import { Toolbar } from "./browser-shell/components/toolbar.js";
import { createMoonProfileBackup } from "../packages/storage/backup/profile-backup.js";
import { CustomizationStore } from "./customization/customization-store.js";
import { CustomizationApplier } from "./customization/customization-applier.js";
import { CustomizationCenter } from "./customization/customization-center.js";
import { CUSTOMIZATION_V2_STORAGE_KEY, CUSTOMIZATION_V3_STORAGE_KEY, type CustomizationConfig, type HomeWidgetId, type SettingsMode, type SettingsView } from "./customization/customization-schema.js";
import { SETTINGS_CATALOG, type SettingsSection } from "./customization/settings-catalog.js";
import { parseMoonHome, serializeMoonHome } from "./customization/moon-home-contract.js";
import { isMoonSettingsUrl, normalizeMoonInternalUrl } from "../packages/navigation/internal-routes.js";
import { FaviconCache } from "./browser-shell/favicon-cache.js";
import { PermissionPromptController } from "./browser-shell/controllers/permission-prompt-controller.js";
import { DEFAULT_FEATURE_FLAGS, featureEnabled } from "../config/feature-flags.js";
import { OnboardingFlow, shouldShowOnboarding } from "./onboarding/onboarding-flow.js";
import { FocusSessionController } from "./focus/focus-session-controller.js";
import { FocusPanel } from "./focus/focus-panel.js";
import { CommandCenter, type CommandCenterItem } from "./command-center/command-center.js";

const AI_ENABLED = featureEnabled(DEFAULT_FEATURE_FLAGS, "ai");
const MODULES_ENABLED = featureEnabled(DEFAULT_FEATURE_FLAGS, "extensions") || featureEnabled(DEFAULT_FEATURE_FLAGS, "plugins");

class BrowserShell {
  readonly #bridge = moonBrowserBridge();
  readonly #customization = CustomizationStore.load();
  readonly #customizationApplier = new CustomizationApplier();
  readonly #faviconCache = new FaviconCache();
  readonly #favicons = new Map<string, string>();
  readonly #siteFavicons = new Map<string, string>();
  readonly #pendingFavicons = new Map<string, Promise<void>>();
  readonly #tabs = new Map<string, Tab>();
  readonly #navigation = new Map<string, Navigation>();
  readonly #tabStrip = new TabStrip({
    onActivate: tabId => { void this.#activate(tabId); },
    onClose: tabId => { void this.#close(tabId); }
  });
  readonly #toolbar = new Toolbar({
    onBack: () => { void this.#command("back"); },
    onForward: () => { void this.#command("forward"); },
    onReload: () => { void this.#refresh(); },
    onHome: () => { void this.#showHome(); },
    onNavigate: value => { void this.#navigate(value); },
    onToggleBookmark: () => { void this.#toggleBookmark(); },
    onOpenSecurity: () => this.#toggleDrawer("security"),
    onOpenAi: () => this.#toggleDrawer("ai"),
    onOpenDownloads: () => this.#toggleDrawer("downloads"),
    onOpenModules: () => this.#toggleDrawer("extensions"),
    onOpenProfile: () => this.#toggleDrawer("profiles"),
    onOpenMenu: () => { void this.#openSettings(); }
  }, { ai: AI_ENABLED, modules: MODULES_ENABLED });
  readonly #omnibox = this.#toolbar.omnibox;
  readonly #homeView = new HomeView(value => { void this.#navigate(value); }, value => { void this.#createTab(value); }, () => this.#toggleDrawer("focus"), {
    onBegin: () => this.#customization.beginPreview(),
    onMove: (source, target) => this.#moveHomeWidget(source, target),
    onNudge: (id, direction) => this.#nudgeHomeWidget(id, direction),
    onResize: (id, direction) => this.#resizeHomeWidget(id, direction),
    onAdd: id => this.#setHomeWidgetVisibility(id, true),
    onRemove: id => this.#setHomeWidgetVisibility(id, false),
    onApply: () => this.#customization.applyPreview(),
    onCancel: () => this.#customization.cancelPreview(),
    onExport: () => this.#bridge?.exportMoonHome(serializeMoonHome(this.#customization.config.home)) ?? Promise.resolve(false),
    onImport: async () => { const content = await this.#bridge?.importMoonHome(); if (!content) return false; const home = parseMoonHome(content); return this.#customization.update(config => { (config as { home: typeof home }).home = home; }); }
  });
  readonly #focusPanel = new FocusPanel({ controller: () => this.#focus, workspaces: () => this.#workspaces, privateWindow: () => this.#windowPrivate, pendingNavigation: () => this.#pendingFocusNavigation, onProceedNavigation: url => { void this.#navigate(url, true); }, onDismissNavigation: () => { this.#pendingFocusNavigation = undefined; }, onEnd: () => this.#closeDrawer() });
  readonly #home = this.#homeView.element;
  readonly #viewport = el("div", "moon-browser-viewport");
  readonly #stage = el("div", "moon-stage");
  readonly #railElement = el("aside", "moon-rail");
  readonly #tabsBar = el("header", "moon-tabs-bar");
  readonly #addTab = btn("moon-add-tab", "Nova aba (Ctrl+T)", "plus");
  readonly #drawer = el("aside", "moon-drawer");
  readonly #drawerBody = el("div", "moon-drawer-body");
  readonly #drawerTitle = el("h2", "moon-drawer-title", "Painel");
  readonly #workspaceBar = new WorkspaceBar({
    onSelect: workspaceId => { void this.#switchWorkspace(workspaceId); },
    onAdd: () => this.#addWorkspace()
  });
  readonly #back = this.#toolbar.back;
  readonly #forward = this.#toolbar.forward;
  readonly #reload = this.#toolbar.reload;
  readonly #bookmark = this.#toolbar.bookmark;
  readonly #securityPill = this.#toolbar.securityPill;
  readonly #securityText = this.#toolbar.securityText;
  readonly #status = el("div", "moon-status");
  readonly #privateBadge = el("div", "moon-private-badge", "ANÔNIMO");
  readonly #profileName = el("span", "", "Padrão");
  readonly #zenExit = btn("moon-zen-exit", "Sair do modo Foco (Ctrl+Shift+Z)", "close");
  readonly #rail = new Map<string, HTMLButtonElement>();
  #workspaces = load<Workspace[]>(KEYS.workspaces, [...WORKSPACES]);
  #bookmarks = load<SavedLink[]>(KEYS.bookmarks, []);
  #history = load<SavedLink[]>(KEYS.history, []);
  #downloads: readonly ManagedDownload[] = [];
  #notes = load<string>(KEYS.notes, "");
  #shortcuts = load<Shortcut[]>(KEYS.shortcuts, []);
  #themes = load<SavedTheme[]>(KEYS.themes, []);
  #adblock: AdblockStatus = { phase: "loading", enabled: true, blockedCount: 0 };
  #sitePermissions: readonly SitePermissionRecord[] = [];
  #workspaceId = this.#workspaces[0]?.id ?? "research";
  #windowPrivate = false;
  #windowGuest = false;
  #activeProfile: LocalProfileSummary | undefined;
  #profiles: readonly LocalProfileSummary[] = [];
  #activeTabId: string | undefined;
  #openDrawer: Drawer | undefined;
  #settings: HTMLElement | undefined;
  #settingsCenter: CustomizationCenter | undefined;
  #settingsReturnHome = true;
  #settingsClosing = false;
  #settingsOpening = false;
  #onboarding: OnboardingFlow | undefined;
  #focus: FocusSessionController | undefined;
  #pendingFocusNavigation: string | undefined;
  #commandCenter: CommandCenter | undefined;
  #commandReturnFocus: HTMLElement | undefined;
  readonly #permissionController: PermissionPromptController | undefined;
  #notesSaveTimer: number | undefined;
  #resizeObserver: ResizeObserver | undefined;

  constructor(readonly container: HTMLElement) {
    this.#permissionController = this.#bridge ? new PermissionPromptController({ container, bridge: this.#bridge, onError: error => this.#showError(error), onPermissionsChanged: records => { this.#sitePermissions = records; this.#renderDrawer(); }, onIdle: async () => { if (!this.#settings) await this.#bridge!.setContentVisible(true); } }) : undefined;
  }

  async start(): Promise<void> {
    this.#build(); this.#customization.setWorkspace(this.#workspaceId); this.#customization.subscribe(change => this.#applyCustomization(change.config)); this.#bindShortcuts(); this.#observe(); this.#startClock();
    if (this.#customization.loadResult.message) this.#flash(this.#customization.loadResult.message);
    if (!this.#bridge) { this.#status.textContent = "Prévia da interface — use npm run dev:desktop para navegar."; return; }
    this.#bridge.onTabUpdated(update => this.#applyUpdate(update));
    this.#bridge.onTabClosed(({ tabId }) => { void this.#handleClosed(tabId); });
    this.#bridge.onDownloadsUpdated(downloads => { this.#downloads = downloads; this.#renderDrawer(); this.#refreshHomeData(); });
    this.#bridge.onAdblockStatus(status => { this.#adblock = status; this.#renderAdblock(); this.#renderDrawer(); });
    this.#bridge.onPermissionRequested(request => this.#permissionController?.enqueue(request));
    try {
      const context = await this.#bridge.getWindowContext(); this.#windowPrivate = context.private; this.#windowGuest = context.guest; this.#profiles = await this.#bridge.listLocalProfiles(); this.#activeProfile = this.#profiles.find(profile => profile.id === context.profileId); this.#renderProfileIdentity(); this.#renderPrivateIdentity(); this.#sitePermissions = await this.#bridge.listSitePermissions();
      const legacyRaw = localStorage.getItem(CUSTOMIZATION_V3_STORAGE_KEY) ?? localStorage.getItem(CUSTOMIZATION_V2_STORAGE_KEY);
      let migrationSource: unknown = this.#customization.document;
      if (legacyRaw) { try { migrationSource = JSON.parse(legacyRaw) as unknown; } catch { /* the validated local V4 recovery remains the safe source */ } }
      const canonical = await this.#bridge.loadCustomization(migrationSource);
      this.#customization.useCanonical(canonical, document => this.#bridge!.commitCustomization(document));
      this.#focus = new FocusSessionController(document.documentElement, context.private ? undefined : localStorage, message => this.#flash(message));
      this.#focus.subscribe(() => this.#renderFocusIndicator());
      await this.#migrateLegacyProfile();
      await this.#reloadProfileData();
      this.#downloads = await this.#bridge.getDownloads();
      this.#adblock = await this.#bridge.getAdblockStatus();
      const preferredAdblock = load<boolean>(KEYS.adblock, true);
      if (this.#adblock.enabled !== preferredAdblock) {
        this.#adblock = await this.#bridge.setAdblockEnabled(preferredAdblock);
      }
      const tabs = await this.#bridge.getTabs();
      tabs.forEach(tab => this.#tabs.set(tab.id, tab));
      const active = tabs.find(tab => tab.active);
      this.#activeTabId = active?.id; this.#workspaceId = active?.workspaceId ?? this.#workspaceId;
      if (tabs.length === 0) await this.#createTab(); else this.#render();
      if (!this.#windowPrivate && shouldShowOnboarding()) await this.#openOnboarding();
    } catch (error) { this.#showError(error); }
  }

  #build(): void {
    const shell = el("div", "moon-browser-shell");
    const rail = this.#railElement;
    const brand = btn("moon-brand", "Moon Browser", "moon"); brand.addEventListener("click", () => void this.#showHome()); rail.append(brand);
    const controls: readonly [string, string, IconName, () => void][] = [
      ["home", "Página inicial", "home", () => void this.#showHome()], ["commands", "Central de comandos", "search", () => { void this.#openCommandCenter(); }], ["profiles", "Gerenciar perfis", "moon", () => this.#toggleDrawer("profiles")], ["workspaces", "Workspaces", "grid", () => this.#toggleDrawer("workspaces")],
      ["bookmarks", "Favoritos", "star", () => this.#toggleDrawer("bookmarks")], ["downloads", "Downloads", "download", () => this.#toggleDrawer("downloads")],
      ["history", "Histórico", "history", () => this.#toggleDrawer("history")], ["translate", "Traduzir página", "translate", () => this.#toggleDrawer("translate")],
      ["notes", "Bloco de notas", "note", () => this.#toggleDrawer("notes")], ["focus", "Foco e Zen", "play", () => this.#toggleDrawer("focus")], ["extensions", "Extensões", "plugin", () => this.#toggleDrawer("extensions")],
      ["ai", "Moon AI", "sparkles", () => this.#toggleDrawer("ai")]
    ];
    controls.filter(([id]) => (id !== "ai" || AI_ENABLED) && (id !== "extensions" || MODULES_ENABLED)).forEach(([id, label, name, action]) => { const control = btn("moon-rail-button", label, name); control.append(el("span", "moon-rail-label", label)); control.addEventListener("click", action); this.#rail.set(id, control); rail.append(control); });
    rail.append(el("div", "moon-rail-spacer"));
    const settings = btn("moon-rail-button", "Configurações", "settings"); settings.append(el("span", "moon-rail-label", "Configurações")); settings.addEventListener("click", () => void this.#openSettings()); this.#rail.set("settings", settings); rail.append(settings);

    const drawerHeader = el("header", "moon-drawer-header"); const drawerClose = btn("moon-icon-button", "Fechar painel", "close"); drawerClose.addEventListener("click", () => this.#closeDrawer());
    const drawerResize = el("div", "moon-drawer-resize"); drawerResize.tabIndex = 0; drawerResize.setAttribute("role", "separator"); drawerResize.setAttribute("aria-label", "Redimensionar painel"); drawerResize.setAttribute("aria-orientation", "vertical");
    drawerHeader.append(this.#drawerTitle, drawerClose); this.#drawer.append(drawerHeader, this.#drawerBody, drawerResize); this.#bindDrawerResize(drawerResize);

    const main = el("section", "moon-browser-main"); const tabsBar = this.#tabsBar; const mark = btn("moon-window-mark", "Gerenciar perfis", "moon"); mark.append(this.#profileName); mark.addEventListener("click", () => this.#toggleDrawer("profiles"));
    this.#addTab.addEventListener("click", () => void this.#createTab()); this.#privateBadge.hidden = true; this.#privateBadge.title = "O modo anônimo não oculta o tráfego do seu provedor, empresa, escola ou dos sites acessados."; tabsBar.append(mark, this.#tabStrip.element, this.#addTab, this.#privateBadge);

    const content = el("div", "moon-content"); this.#renderHomeShortcuts(); this.#stage.append(this.#home, this.#viewport, this.#status); content.append(this.#stage);
    this.#zenExit.append(el("span", "", "Sair do Foco")); this.#zenExit.hidden = true; this.#zenExit.addEventListener("click", () => this.#focus?.end());
    main.append(tabsBar, this.#toolbar.element, this.#workspaceBar.element, content); shell.append(rail, this.#drawer, main); this.container.replaceChildren(shell, this.#zenExit);
    this.#renderAdblock();
  }

  async #createTab(url?: string): Promise<void> { if (!this.#bridge) return; try { const tab = await this.#bridge.createTab(url, this.#workspaceId); this.#tabs.set(tab.id, tab); this.#activeTabId = tab.id; this.#render(); } catch (error) { this.#showError(error); } }
  async #activate(tabId: string): Promise<void> { if (!this.#bridge || !this.#tabs.has(tabId)) return; if (tabId !== this.#activeTabId && this.#settingsCenter?.presentation === "page") await this.#dismissSettings(false); this.#activeTabId = tabId; for (const [id, tab] of this.#tabs) this.#tabs.set(id, { ...tab, active: id === tabId }); this.#render(); try { await this.#bridge.activateTab(tabId); } catch (error) { this.#showError(error); } }
  async #close(tabId: string): Promise<void> { if (!this.#bridge) return; try { await this.#bridge.closeTab(tabId); } catch (error) { this.#showError(error); } }
  async #handleClosed(tabId: string): Promise<void> { this.#tabs.delete(tabId); this.#navigation.delete(tabId); this.#favicons.delete(tabId); this.#pendingFavicons.delete(tabId); const tabs = this.#workspaceTabs(); const active = tabs.find(tab => tab.active) ?? tabs.at(-1); this.#activeTabId = active?.id; if (!active) await this.#createTab(); else await this.#activate(active.id); this.#renderDrawer(); }
  async #showHome(): Promise<void> { this.#closeDrawer(); if (!this.#bridge) return; if (this.#settingsCenter?.presentation === "page") await this.#dismissSettings(false); if (!this.#activeTabId) return this.#createTab(); try { await this.#bridge.showHome(this.#activeTabId); } catch (error) { this.#showError(error); } }
  async #navigate(value: string, bypassFocus = false): Promise<void> { if (!this.#bridge || !value.trim()) return; const url = this.#resolveInput(value); if (url === "moon://newtab") return this.#showHome(); if (!bypassFocus && this.#focus && !this.#focus.isAllowed(url, this.#workspaceId)) { this.#focus.interrupt(); this.#pendingFocusNavigation = url; this.#toggleDrawer("focus"); return; } this.#pendingFocusNavigation = undefined; this.#closeDrawer(); if (this.#settingsCenter?.presentation === "page") await this.#dismissSettings(false); if (!this.#activeTabId) return this.#createTab(url); this.#status.textContent = ""; try { const internal = normalizeMoonInternalUrl(url); if (internal) await this.#bridge.showInternalPage(this.#activeTabId, internal); else await this.#bridge.navigate(this.#activeTabId, url); } catch (error) { this.#showError(error); } }
  #resolveInput(value: string): string {
    const trimmed = value.trim(); const internal = normalizeMoonInternalUrl(trimmed); if (internal) return internal; const generic = resolveNavigationInput(trimmed); if (!generic.includes("duckduckgo.com/?q=")) return generic;
    const search = this.#customization.config.search; const keywordMatch = /^(?<keyword>[a-z0-9-]+):\s*(?<query>.+)$/i.exec(trimmed);
    const provider = keywordMatch?.groups ? search.providers.find(item => item.keyword === keywordMatch.groups?.keyword) : search.providers.find(item => item.id === search.defaultEngine);
    const query = keywordMatch?.groups?.query ?? trimmed; const template = provider?.template ?? "https://duckduckgo.com/?q={query}";
    return template.replace("{query}", encodeURIComponent(query));
  }
  async #command(command: "back" | "forward"): Promise<void> { if (!this.#bridge || !this.#activeTabId) return; try { await this.#bridge[command](this.#activeTabId); } catch (error) { this.#showError(error); } }
  async #refresh(): Promise<void> { if (!this.#bridge || !this.#activeTabId) return; try { if (this.#tabs.get(this.#activeTabId)?.loading) await this.#bridge.stop(this.#activeTabId); else await this.#bridge.reload(this.#activeTabId); } catch (error) { this.#showError(error); } }

  #applyUpdate(update: TabUpdate): void {
    const previous = this.#tabs.get(update.tab.id); this.#tabs.set(update.tab.id, update.tab); this.#navigation.set(update.tab.id, update.navigation);
    if (update.tab.active) { this.#activeTabId = update.tab.id; const workspaceId = update.tab.workspaceId ?? this.#workspaceId; if (workspaceId !== this.#workspaceId) { this.#workspaceId = workspaceId; this.#customization.setWorkspace(workspaceId); } }
    if (previous?.loading && !update.tab.loading && !update.tab.private && this.#isWeb(update.tab.url)) this.#recordHistory(update.tab);
    if (update.error) this.#status.textContent = `Não foi possível abrir a página: ${update.error}`; void this.#hydrateFavicon(update.tab); this.#render(); this.#renderDrawer();
  }

  #render(): void {
    const active = this.#activeTabId ? this.#tabs.get(this.#activeTabId) : undefined; this.#renderTabs(); this.#renderWorkspaces(); const isHome = !active || active.url === "moon://newtab"; const isSettings = Boolean(active && isMoonSettingsUrl(active.url));
    document.documentElement.dataset.moonPage = isHome ? "home" : isSettings ? "settings" : "web";
    if (active && isSettings) void this.#ensureSettingsPage(active.url); else if (this.#settingsCenter?.presentation === "page" && !this.#settingsClosing) void this.#dismissSettings(false);
    this.#home.hidden = !isHome; this.#homeView.setVisible(isHome); this.#omnibox.value = isHome ? "" : active.url; const nav = active ? this.#navigation.get(active.id) : undefined; this.#back.disabled = !nav?.canGoBack; this.#forward.disabled = !nav?.canGoForward;
    this.#reload.replaceChildren(svg(active?.loading ? "stop" : "reload")); this.#reload.title = active?.loading ? "Parar" : "Recarregar";
    const saved = active ? this.#bookmarks.some(item => item.url === active.url) : false; this.#bookmark.classList.toggle("is-active", saved); this.#bookmark.title = saved ? "Remover dos favoritos" : "Adicionar aos favoritos";
    this.#rail.get("home")?.classList.toggle("is-active", isHome && !this.#openDrawer); if (isHome) this.#refreshHomeData(); requestAnimationFrame(() => this.#syncBounds());
  }

  #renderTabs(): void {
    this.#tabStrip.render(this.#workspaceTabs(), this.#activeTabId, this.#favicons);
  }

  #renderWorkspaces(): void {
    this.#workspaceBar.render(this.#workspaces, [...this.#tabs.values()], this.#workspaceId);
  }
  #renderHomeShortcuts(): void {
    this.#refreshHomeData();
  }
  async #switchWorkspace(id: string): Promise<void> { this.#workspaceId = id; this.#customization.setWorkspace(id); const tabs = this.#workspaceTabs(); if (!tabs.length) await this.#createTab(); else await this.#activate(tabs.find(tab => tab.active)?.id ?? tabs[0]!.id); this.#renderDrawer(); }
  #addWorkspace(): void { void this.#createWorkspace(`Espaço ${this.#workspaces.length + 1}`); }
  #workspaceTabs(): Tab[] { return [...this.#tabs.values()].filter(tab => (tab.workspaceId ?? "research") === this.#workspaceId); }

  async #toggleBookmark(): Promise<void> {
    const tab = this.#activeTabId ? this.#tabs.get(this.#activeTabId) : undefined; if (!tab || !this.#isWeb(tab.url)) { this.#flash("Abra um site para adicioná-lo aos favoritos."); return; }
    const found = this.#bookmarks.find(item => item.url === tab.url);
    if (found) { this.#bookmarks = this.#bookmarks.filter(item => item.id !== found.id); if (await this.#mutateProfileData({ type: "bookmark:delete", id: found.id })) this.#flash("Removido dos favoritos."); }
    else { const value = { id: crypto.randomUUID(), title: tab.title || tab.url, url: tab.url, time: Date.now() }; this.#bookmarks = [value, ...this.#bookmarks]; if (await this.#mutateProfileData({ type: "bookmark:save", value })) this.#flash("Adicionado aos favoritos."); }
    this.#render(); this.#renderDrawer();
  }
  #recordHistory(tab: Tab): void { const latest = this.#history[0]; if (latest?.url === tab.url && Date.now() - latest.time < 30_000) return; const value = { id: crypto.randomUUID(), title: tab.title || tab.url, url: tab.url, time: Date.now() }; this.#history = [value, ...this.#history].slice(0, 500); void this.#mutateProfileData({ type: "history:record", value }); }

  #toggleDrawer(name: Drawer): void { if (this.#openDrawer === name) return this.#closeDrawer(); this.#openDrawer = name; this.#drawer.classList.add("is-open"); this.#renderDrawer(); requestAnimationFrame(() => this.#syncBounds()); }
  #closeDrawer(): void { this.#openDrawer = undefined; this.#drawer.classList.remove("is-open"); this.#rail.forEach(item => item.classList.remove("is-active")); this.#render(); requestAnimationFrame(() => this.#syncBounds()); }
  #renderDrawer(): void {
    if (!this.#openDrawer) return; const titles: Readonly<Record<Drawer, string>> = { profiles: "Gerenciar perfis", workspaces: "Workspaces", bookmarks: "Favoritos", downloads: "Downloads", history: "Histórico", translate: "Tradutor", notes: "Bloco de notas", focus: "Foco e Zen", extensions: "Extensões", ai: "Moon AI", security: "Proteção" };
    this.#drawerTitle.textContent = titles[this.#openDrawer]; this.#drawerBody.replaceChildren(); this.#rail.forEach(item => item.classList.remove("is-active")); this.#rail.get(this.#openDrawer)?.classList.add("is-active");
    if (this.#openDrawer === "profiles") this.#profilesDrawer(); if (this.#openDrawer === "workspaces") this.#workspaceDrawer(); if (this.#openDrawer === "bookmarks") this.#bookmarksDrawer(); if (this.#openDrawer === "downloads") this.#downloadsDrawer(); if (this.#openDrawer === "history") this.#historyDrawer(); if (this.#openDrawer === "translate") this.#translateDrawer(); if (this.#openDrawer === "notes") this.#notesDrawer(); if (this.#openDrawer === "focus") this.#focusPanel.render(this.#drawerBody); if (this.#openDrawer === "extensions") this.#extensionsDrawer(); if (this.#openDrawer === "ai") this.#aiDrawer(); if (this.#openDrawer === "security") this.#securityDrawer();
  }
  #profilesDrawer(): void {
    this.#drawerBody.append(el("p", "moon-drawer-description", "Perfis isolam sessões, histórico, temas, Home e preferências. Workspaces continuam dentro de cada perfil."));
    if (this.#windowPrivate) this.#drawerBody.append(el("div", "moon-info-card", "Feche a janela anônima para criar, editar ou alternar perfis."));
    const list = el("div", "moon-profile-list");
    this.#profiles.forEach(profile => {
      const card = el("article", `moon-profile-card${profile.id === this.#activeProfile?.id ? " is-active" : ""}`);
      const header = el("div", "moon-profile-card-header"); const avatar = el("span", "moon-profile-avatar", profile.name[0]?.toUpperCase() ?? "M"); avatar.style.background = profile.color;
      const copy = el("span", "moon-list-copy"); copy.append(el("strong", "", profile.name), el("small", "", profile.kind === "guest" ? "Temporário · apagado ao fechar" : profile.default ? "Perfil padrão" : "Perfil local isolado"));
      header.append(avatar, copy); if (profile.id === this.#activeProfile?.id) header.append(el("span", "moon-profile-active", "ATIVO")); card.append(header);
      const actions = el("div", "moon-profile-actions");
      if (profile.id !== this.#activeProfile?.id) { const open = btn("moon-text-button", `Alternar para ${profile.name}`, "chevron"); open.append(el("span", "", "Alternar")); open.disabled = this.#windowPrivate; open.addEventListener("click", () => { void this.#switchLocalProfile(profile.id); }); actions.append(open); }
      if (profile.kind === "persistent") {
        const edit = btn("moon-text-button", `Editar ${profile.name}`, "palette"); edit.append(el("span", "", "Editar")); edit.disabled = this.#windowPrivate; actions.append(edit);
        const form = this.#profileForm(profile, async value => { await this.#bridge!.updateLocalProfile({ id: profile.id, ...value }); await this.#reloadLocalProfiles(); }); form.hidden = true; edit.addEventListener("click", () => { form.hidden = !form.hidden; }); card.append(actions, form);
      } else card.append(actions);
      if (!profile.default && profile.id !== this.#activeProfile?.id) { const remove = btn("moon-text-button is-danger", `Excluir ${profile.name}`, "trash"); remove.append(el("span", "", "Excluir")); remove.disabled = this.#windowPrivate; remove.addEventListener("click", () => { void this.#deleteLocalProfile(profile.id); }); actions.append(remove); }
      list.append(card);
    });
    this.#drawerBody.append(list);
    if (this.#windowPrivate || this.#windowGuest) return;
    const createTitle = el("h3", "moon-panel-section-title", "Novo perfil local");
    this.#drawerBody.append(createTitle, this.#profileForm(undefined, async value => { await this.#bridge!.createLocalProfile(value); await this.#reloadLocalProfiles(); }));
    const guest = btn("moon-secondary-button moon-profile-guest", "Abrir perfil convidado", "moon"); guest.append(el("span", "", "Usar como convidado")); guest.addEventListener("click", () => { void this.#createGuestProfile(); }); this.#drawerBody.append(guest);
  }
  #profileForm(profile: LocalProfileSummary | undefined, onSubmit: (value: { readonly name: string; readonly avatar: LocalProfileAvatar; readonly color: string }) => Promise<void>): HTMLFormElement {
    const form = el("form", "moon-profile-form"); const name = el("input", "moon-settings-input"); name.value = profile?.name ?? ""; name.placeholder = "Nome do perfil"; name.required = true; name.maxLength = 40;
    const avatar = el("select", "moon-select"); (["moon", "person", "briefcase", "palette", "game"] as const).forEach(value => { const option = el("option", "", ({ moon: "Lua", person: "Pessoal", briefcase: "Trabalho", palette: "Criativo", game: "Jogos" })[value]); option.value = value; option.selected = profile?.avatar === value; avatar.append(option); });
    const color = el("input", "moon-profile-color"); color.type = "color"; color.value = profile?.color ?? "#8b5cf6"; color.setAttribute("aria-label", "Cor do perfil");
    const saveButton = btn("moon-primary-button", profile ? "Salvar perfil" : "Criar perfil", profile ? "palette" : "plus"); saveButton.type = "submit"; saveButton.append(el("span", "", profile ? "Salvar" : "Criar"));
    form.append(name, avatar, color, saveButton); form.addEventListener("submit", event => { event.preventDefault(); saveButton.disabled = true; void onSubmit({ name: name.value, avatar: avatar.value as LocalProfileAvatar, color: color.value }).then(() => { if (!profile) name.value = ""; }).catch(error => this.#showError(error)).finally(() => { saveButton.disabled = false; }); }); return form;
  }
  async #reloadLocalProfiles(): Promise<void> { if (!this.#bridge) return; this.#profiles = await this.#bridge.listLocalProfiles(); if (this.#activeProfile) this.#activeProfile = this.#profiles.find(profile => profile.id === this.#activeProfile!.id) ?? this.#activeProfile; this.#renderProfileIdentity(); this.#renderDrawer(); }
  async #switchLocalProfile(id: string): Promise<void> {
    if (!this.#bridge || id === this.#activeProfile?.id) return;
    if (this.#customization.dirty && !window.confirm("Há um rascunho de personalização. Descartar o rascunho e alternar de perfil?")) return;
    if (this.#customization.dirty) this.#customization.cancelPreview();
    try { await this.#bridge.openLocalProfile(id); } catch (error) { this.#showError(error); }
  }
  async #createGuestProfile(): Promise<void> {
    if (!this.#bridge) return;
    if (this.#customization.dirty && !window.confirm("Há um rascunho de personalização. Descartá-lo e abrir um perfil convidado?")) return;
    if (this.#customization.dirty) this.#customization.cancelPreview();
    try { await this.#bridge.createGuestProfile(); } catch (error) { this.#showError(error); }
  }
  async #deleteLocalProfile(id: string): Promise<void> {
    if (!this.#bridge) return;
    try {
      const summary = await this.#bridge.getLocalProfileDeletionSummary(id);
      const confirmation = window.prompt(`Isso removerá ${summary.includes.join(", ")} do perfil “${summary.profile.name}”. Digite exatamente o nome para continuar.`);
      if (confirmation === null) return;
      const backup = window.confirm("Criar um backup local recuperável antes de excluir?");
      const result = await this.#bridge.deleteLocalProfile({ id, confirmation, backup });
      await this.#reloadLocalProfiles(); this.#flash(result.backupPath ? "Perfil excluído; backup local criado." : "Perfil excluído permanentemente.");
    } catch (error) { this.#showError(error); }
  }
  #workspaceDrawer(): void {
    this.#drawerBody.append(el("p", "moon-drawer-description", "Separe abas e sessões por contexto.")); const list = el("div", "moon-panel-list");
    this.#workspaces.forEach(workspace => { const count = [...this.#tabs.values()].filter(tab => (tab.workspaceId ?? "research") === workspace.id).length; const wrapper = el("div", "moon-workspace-manage-row"); const row = btn(`moon-workspace-row${workspace.id === this.#workspaceId ? " is-active" : ""}`, `Abrir ${workspace.name}`); const copy = el("span", "moon-list-copy"); copy.append(el("strong", "", workspace.name), el("small", "", `${count} ${count === 1 ? "aba" : "abas"}`)); row.append(el("span", "moon-workspace-mark", workspace.name[0]?.toUpperCase()), copy, svg("chevron")); row.addEventListener("click", () => void this.#switchWorkspace(workspace.id)); wrapper.append(row); if (this.#workspaces.length > 1 && count === 0) { const remove = btn("moon-icon-button", `Excluir ${workspace.name}`, "trash"); remove.addEventListener("click", () => { void this.#removeWorkspace(workspace.id); }); wrapper.append(remove); } list.append(wrapper); });
    const create = el("form", "moon-custom-form"); const name = el("input", "moon-settings-input"); name.placeholder = "Nome do workspace"; const add = btn("moon-primary-button", "Criar novo workspace", "plus"); add.type = "submit"; add.append(el("span", "", "Criar")); create.append(name, add); create.addEventListener("submit", event => { event.preventDefault(); const value = name.value.trim(); if (value) void this.#createWorkspace(value); }); this.#drawerBody.append(list, create);
  }
  #bookmarksDrawer(): void {
    const summary = el("div", "moon-panel-summary"); summary.append(el("span", "", `${this.#bookmarks.length} salvos`)); const current = btn("moon-text-button", "Favoritar página atual", "star"); current.append(el("span", "", "Página atual")); current.addEventListener("click", () => { void this.#toggleBookmark(); }); summary.append(current); this.#drawerBody.append(summary);
    if (!this.#bookmarks.length) return this.#empty("star", "Nenhum favorito", "Use a estrela na barra de endereço para salvar um site."); const list = el("div", "moon-panel-list"); this.#bookmarks.forEach(item => list.append(this.#linkRow(item, () => { void this.#removeBookmark(item.id); }))); this.#drawerBody.append(list);
  }
  #historyDrawer(): void {
    const summary = el("div", "moon-panel-summary"); summary.append(el("span", "", `${this.#history.length} páginas`)); const clear = btn("moon-text-button is-danger", "Limpar histórico", "trash"); clear.append(el("span", "", "Limpar")); clear.disabled = !this.#history.length; clear.addEventListener("click", () => { void this.#clearHistory(); }); summary.append(clear); this.#drawerBody.append(summary);
    if (!this.#history.length) return this.#empty("history", "Histórico vazio", "As páginas visitadas aparecerão aqui."); const list = el("div", "moon-panel-list"); this.#history.slice(0, 100).forEach(item => list.append(this.#linkRow(item, undefined, new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(item.time)))); this.#drawerBody.append(list);
  }
  #downloadsDrawer(): void {
    const summary = el("div", "moon-panel-summary");
    summary.append(el("span", "", `${this.#downloads.length} downloads`));
    const clear = btn("moon-text-button", "Limpar downloads finalizados", "trash");
    clear.append(el("span", "", "Limpar concluídos"));
    clear.disabled = !this.#downloads.some(item => ["completed", "cancelled", "failed"].includes(item.state));
    clear.addEventListener("click", () => void this.#bridge?.clearFinishedDownloads());
    summary.append(clear);
    this.#drawerBody.append(summary);
    if (!this.#downloads.length) return this.#empty("download", "Nenhum download", "Arquivos baixados pelos sites aparecerão aqui com progresso real.");
    const list = el("div", "moon-download-list");
    this.#downloads.forEach(download => {
      const row = el("article", "moon-download-row");
      const header = el("div", "moon-download-header");
      header.append(el("strong", "", download.filename), el("span", `moon-download-state is-${download.state}`, this.#downloadStateLabel(download.state)));
      const progress = el("progress", "moon-download-progress");
      progress.max = 100; progress.value = download.percentage ?? 0;
      const detail = el("div", "moon-download-detail", `${this.#bytes(download.receivedBytes)} / ${download.totalBytes > 0 ? this.#bytes(download.totalBytes) : "tamanho desconhecido"}`);
      const actions = el("div", "moon-download-actions");
      if (download.state === "in-progress") actions.append(this.#downloadAction("Pausar", "pause", () => void this.#bridge?.pauseDownload(download.id)));
      if (download.state === "paused") actions.append(this.#downloadAction("Continuar", "play", () => void this.#bridge?.resumeDownload(download.id)));
      if (["in-progress", "paused"].includes(download.state)) actions.append(this.#downloadAction("Cancelar", "close", () => void this.#bridge?.cancelDownload(download.id)));
      if (download.state === "completed") {
        actions.append(this.#downloadAction("Abrir", "play", () => void this.#bridge?.openDownload(download.id)));
        actions.append(this.#downloadAction("Pasta", "folder", () => void this.#bridge?.showDownloadInFolder(download.id)));
      }
      row.append(header, progress, detail, actions); list.append(row);
    });
    this.#drawerBody.append(list);
  }
  #translateDrawer(): void {
    const active = this.#activeTabId ? this.#tabs.get(this.#activeTabId) : undefined;
    const title = el("div", "moon-tool-hero"); title.append(svg("translate"), el("strong", "", "Traduzir página"));
    const language = el("select", "moon-select");
    [["pt", "Português"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["ja", "日本語"]].forEach(([value, label]) => { const option = el("option", "", label); option.value = value!; language.append(option); });
    const translate = btn("moon-primary-button", "Traduzir página atual", "translate"); translate.append(el("span", "", "Traduzir página atual")); translate.disabled = !active || !this.#isWeb(active.url);
    translate.addEventListener("click", () => { if (active && this.#isWeb(active.url)) void this.#navigate(`https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(language.value)}&u=${encodeURIComponent(active.url)}`); });
    this.#drawerBody.append(title, el("p", "moon-drawer-description", "A página será aberta pelo Google Translate no idioma escolhido."), language, translate);
  }
  #notesDrawer(): void {
    const title = el("div", "moon-tool-hero"); title.append(svg("note"), el("strong", "", "Anotações rápidas"));
    const textarea = el("textarea", "moon-notes-input"); textarea.value = this.#notes; textarea.placeholder = "Suas anotações ficam salvas localmente neste perfil do Moon."; textarea.rows = 14;
    const status = el("span", "moon-notes-status", this.#windowPrivate ? "Desativado nesta janela" : "Salvo no perfil");
    textarea.disabled = this.#windowPrivate; if (this.#windowPrivate) textarea.placeholder = "Notas persistentes ficam desativadas em janelas anônimas.";
    textarea.addEventListener("input", () => { this.#notes = textarea.value; this.#refreshHomeData(); status.textContent = "Salvando…"; if (this.#notesSaveTimer !== undefined) window.clearTimeout(this.#notesSaveTimer); this.#notesSaveTimer = window.setTimeout(() => { void this.#saveNotes(status); }, 250); });
    this.#drawerBody.append(title, textarea, status);
  }
  #renderFocusIndicator(): void { const state = this.#focus?.state; this.#zenExit.hidden = !state; const countdown = this.#zenExit.querySelector("span"); if (countdown) countdown.textContent = this.#focusPanel.indicatorText(); this.#focusPanel.updateLive(); }
  #extensionsDrawer(): void {
    const title = el("div", "moon-tool-hero"); title.append(svg("plugin"), el("strong", "", "Extensões"));
    const card = el("div", "moon-info-card"); card.append(svg("shield"), el("p", "", "O runtime de extensões existe no Core, mas nenhuma extensão foi instalada neste perfil. O Moon não exibirá extensões fictícias como se estivessem ativas."));
    const compatibility = el("div", "moon-extension-status"); compatibility.append(el("strong", "", "Compatibilidade Chromium"), el("span", "", "Em desenvolvimento"));
    this.#drawerBody.append(title, card, compatibility);
  }
  #linkRow(item: SavedLink, remove?: () => void, meta?: string): HTMLElement { const row = el("div", "moon-link-row"); const open = btn("moon-link-main", `Abrir ${item.title}`); const copy = el("span", "moon-list-copy"); copy.append(el("strong", "", item.title), el("small", "", meta ?? this.#hostname(item.url))); const mark = el("span", "moon-site-mark", item.title[0]?.toUpperCase()); const favicon = this.#faviconForUrl(item.url); if (favicon) { const image = document.createElement("img"); image.src = favicon; image.alt = ""; image.draggable = false; mark.replaceChildren(image); } open.append(mark, copy); open.addEventListener("click", () => void this.#navigate(item.url)); row.append(open); if (remove) { const removeButton = btn("moon-icon-button", `Remover ${item.title}`, "close"); removeButton.addEventListener("click", remove); row.append(removeButton); } return row; }
  #aiDrawer(): void {
    const hero = el("div", "moon-ai-hero"); hero.append(svg("sparkles"), el("strong", "", "Moon AI"), el("span", "moon-preview-badge", "PREVIEW"));
    const form = el("form", "moon-ai-form"); const input = el("textarea", "moon-ai-input"); input.placeholder = "O que você quer descobrir?"; input.rows = 5; const search = btn("moon-primary-button", "Pesquisar pergunta", "search"); search.type = "submit"; search.append(el("span", "", "Pesquisar na web")); form.append(input, search); form.addEventListener("submit", event => { event.preventDefault(); void this.#navigate(input.value); });
    const info = el("div", "moon-info-card"); info.append(svg("sparkles"), el("p", "", "A conexão com um provedor de IA será feita no processo seguro, sem expor chaves na interface.")); this.#drawerBody.append(hero, el("p", "moon-drawer-description", "Nesta versão local, o Moon encaminha a pergunta ao motor de busca escolhido — sem fingir que já existe uma IA conectada."), form, info);
  }
  #securityDrawer(): void {
    const hero = el("div", "moon-security-hero"); hero.append(svg("shield"), el("strong", "", "Navegação isolada"), el("span", "", "ATIVA"));
    const adblock = el("div", "moon-adblock-control"); const copy = el("span", "moon-list-copy"); copy.append(el("strong", "", "Moon AdBlock"), el("small", "", this.#adblockDetail()));
    const toggle = btn(`moon-adblock-toggle${this.#adblock.enabled ? " is-active" : ""}`, this.#adblock.enabled ? "Desativar AdBlock" : "Ativar AdBlock"); toggle.append(el("span")); toggle.disabled = this.#adblock.phase === "loading" || this.#adblock.phase === "failed"; toggle.addEventListener("click", () => void this.#setAdblockEnabled(!this.#adblock.enabled)); adblock.append(copy, toggle);
    const list = el("div", "moon-security-list");
    [["Context isolation", "A página não acessa APIs internas do Moon."], ["Sandbox", "Sites executam em processos restritos do Chromium."], ["Navegação", "Somente HTTP e HTTPS são aceitos."], ["Workspaces", "Cada espaço usa uma sessão separada."]].forEach(([title, detail]) => { const item = el("div", "moon-security-item"); item.append(el("span", "moon-check", "✓"), el("strong", "", title), el("p", "", detail)); list.append(item); });
    const permissionTitle = el("h3", "moon-panel-section-title", "Permissões por site"); const permissions = el("div", "moon-panel-list");
    if (this.#windowPrivate) permissions.append(el("p", "moon-drawer-description", "Esta janela usa decisões temporárias e não altera permissões persistentes."));
    else if (!this.#sitePermissions.length) permissions.append(el("p", "moon-drawer-description", "Nenhuma decisão persistente. Os sites perguntarão antes de acessar recursos protegidos."));
    else this.#sitePermissions.forEach(record => { const row = el("div", "moon-link-row"); const copy = el("span", "moon-list-copy"); copy.append(el("strong", "", this.#hostname(record.origin)), el("small", "", `${record.permission} · ${record.decision === "allow" ? "Permitido" : "Negado"}`)); const remove = btn("moon-icon-button", `Esquecer ${record.permission} em ${record.origin}`, "close"); remove.addEventListener("click", () => { void this.#clearSitePermission(record); }); row.append(copy, remove); permissions.append(row); });
    this.#drawerBody.append(hero, adblock, list, permissionTitle, permissions);
  }
  #renderAdblock(): void { this.#securityPill.classList.toggle("is-disabled", this.#adblock.phase === "disabled" || this.#adblock.phase === "failed"); this.#securityPill.classList.toggle("is-loading", this.#adblock.phase === "loading"); this.#securityText.textContent = this.#adblock.phase === "loading" ? "AdBlock carregando" : this.#adblock.phase === "failed" ? "AdBlock indisponível" : this.#adblock.enabled ? `${this.#adblock.blockedCount} bloqueados` : "AdBlock desligado"; }
  async #setAdblockEnabled(enabled: boolean): Promise<void> { if (!this.#bridge) return; this.#adblock = await this.#bridge.setAdblockEnabled(enabled); save(KEYS.adblock, enabled); this.#renderAdblock(); this.#renderDrawer(); }
  #adblockDetail(): string { if (this.#adblock.phase === "loading") return "Carregando filtros reais…"; if (this.#adblock.phase === "failed") return `Falhou: ${this.#adblock.error ?? "erro desconhecido"}`; return this.#adblock.enabled ? `${this.#adblock.blockedCount} requisições bloqueadas nesta sessão` : "Proteção de anúncios desativada"; }
  #downloadAction(label: string, name: IconName, action: () => void): HTMLButtonElement { const actionButton = btn("moon-download-action", label, name); actionButton.append(el("span", "", label)); actionButton.addEventListener("click", action); return actionButton; }
  #downloadStateLabel(state: ManagedDownload["state"]): string { return ({ "in-progress": "Baixando", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado", failed: "Falhou" })[state]; }
  #bytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`; return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`; }
  #empty(name: IconName, title: string, detail: string): void { const empty = el("div", "moon-empty"); empty.append(svg(name), el("strong", "", title), el("p", "", detail)); this.#drawerBody.append(empty); }

  async #openSettings(presentation: "modal" | "page" = "modal", initialSection?: SettingsSection): Promise<void> {
    if (this.#settingsCenter) {
      if (presentation === "page") { this.#settingsCenter.setPresentation("page"); this.#stage.append(this.#settingsCenter.element); }
      return;
    }
    if (this.#settingsOpening) return;
    this.#settingsOpening = true;
    this.#closeDrawer();
    if (this.#bridge) await this.#bridge.setContentVisible(false);
    const workspaceName = this.#workspaces.find(workspace => workspace.id === this.#workspaceId)?.name ?? "workspace atual";
    const center = new CustomizationCenter({
      store: this.#customization,
      workspaceName,
      presentation,
      initialSection,
      onExport: content => this.#bridge?.exportCustomization(content) ?? Promise.resolve(false),
      onExportDiagnostic: content => this.#bridge?.exportSettingsDiagnostic(content) ?? Promise.resolve(false),
      onImport: () => this.#bridge?.importCustomization() ?? Promise.resolve(null),
      onFetchWallpaper: url => this.#bridge?.fetchWallpaper(url) ?? Promise.reject(new Error("Wallpapers HTTPS exigem o aplicativo desktop.")),
      onImportMoonTheme: () => this.#bridge?.importMoonTheme() ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onConfirmMoonTheme: intentId => this.#bridge?.confirmMoonTheme(intentId) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onCancelMoonTheme: intentId => this.#bridge?.cancelMoonTheme(intentId) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onListMoonThemes: () => this.#bridge?.listMoonThemes() ?? Promise.resolve([]),
      onApplyMoonTheme: id => this.#bridge?.applyMoonTheme(id) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onActivateMoonTheme: id => this.#bridge?.activateMoonTheme(id) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onRollbackMoonTheme: packageId => this.#bridge?.rollbackMoonTheme(packageId) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onRemoveMoonTheme: id => this.#bridge?.removeMoonTheme(id) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      onExportMoonTheme: id => this.#bridge?.exportMoonTheme(id) ?? Promise.reject(new Error("Moon Themes exigem o aplicativo desktop.")),
      shortcuts: () => this.#shortcuts,
      onAddShortcut: shortcut => { this.#shortcuts = [...this.#shortcuts, { ...shortcut, id: crypto.randomUUID() }]; save(KEYS.shortcuts, this.#shortcuts); this.#refreshHomeData(); },
      onRemoveShortcut: id => { this.#shortcuts = this.#shortcuts.filter(shortcut => shortcut.id !== id); save(KEYS.shortcuts, this.#shortcuts); this.#refreshHomeData(); },
      onDiscoverImportSources: () => this.#bridge?.discoverImportSources() ?? Promise.resolve([]),
      onImportBrowserProfile: async (sourceId, categories) => { if (!this.#bridge) throw new Error("Importação exige o aplicativo desktop."); const result = await this.#bridge.importBrowserProfile({ sourceId, categories }); await this.#reloadProfileData(); return result; },
      onImportBookmarksHtml: async () => { if (!this.#bridge) throw new Error("Importação exige o aplicativo desktop."); const result = await this.#bridge.importBookmarksHtml(); if (result) await this.#reloadProfileData(); return result; },
      onOpenPage: section => this.#showSettingsPage(section),
      onNavigateSection: (section, mode) => { if (center.presentation === "page") return this.#navigateSettingsSection(section, mode); },
      onClose: async applied => {
        const wasPage = center.presentation === "page"; const returnHome = this.#settingsReturnHome; this.#settingsClosing = true;
        center.element.remove();
        this.#settings = undefined;
        this.#settingsCenter = undefined;
        this.#rail.get("settings")?.classList.remove("is-active");
        this.#flash(applied ? "Personalização aplicada." : "Preview cancelado; estado anterior restaurado.");
        if (this.#bridge && wasPage && returnHome && this.#activeTabId && isMoonSettingsUrl(this.#tabs.get(this.#activeTabId)?.url ?? "")) await this.#bridge.showHome(this.#activeTabId);
        if (this.#bridge && !this.#permissionController?.active) await this.#bridge.setContentVisible(true);
        this.#settingsReturnHome = true; this.#settingsClosing = false;
        requestAnimationFrame(() => this.#syncBounds());
      }
    });
    this.#settingsCenter = center;
    this.#settings = center.element;
    (presentation === "page" ? this.#stage : this.container).append(center.element);
    this.#rail.get("settings")?.classList.add("is-active");
    this.#settingsOpening = false;
  }

  async #openOnboarding(): Promise<void> {
    if (!this.#bridge || this.#onboarding) return;
    await this.#bridge.setContentVisible(false);
    const flow = new OnboardingFlow({
      store: this.#customization,
      onDiscoverImportSources: () => this.#bridge!.discoverImportSources(),
      onImportBrowserProfile: async (sourceId, categories) => { const result = await this.#bridge!.importBrowserProfile({ sourceId, categories }); await this.#reloadProfileData(); return result; },
      onImportBookmarksHtml: async () => { const result = await this.#bridge!.importBookmarksHtml(); if (result) await this.#reloadProfileData(); return result; },
      onClose: async completed => { this.#onboarding = undefined; await this.#bridge!.setContentVisible(true); if (completed) { await this.#showHome(); requestAnimationFrame(() => this.#omnibox.focus()); } requestAnimationFrame(() => this.#syncBounds()); }
    });
    this.#onboarding = flow;
    this.container.append(flow.element);
  }

  async #openCommandCenter(): Promise<void> {
    if (this.#commandCenter || this.#onboarding) return;
    this.#closeDrawer(); this.#commandReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    if (this.#bridge) await this.#bridge.setContentVisible(false);
    const center = new CommandCenter({ items: () => this.#commandItems(), onClose: () => { this.#commandCenter = undefined; requestAnimationFrame(() => { this.#syncBounds(); if (this.#bridge && !this.#settingsCenter && !this.#permissionController?.active) void this.#bridge.setContentVisible(this.#activeWebSurface()); }); this.#commandReturnFocus?.focus(); this.#commandReturnFocus = undefined; } });
    this.#commandCenter = center; this.container.append(center.element);
  }

  #commandItems(): readonly CommandCenterItem[] {
    const commands: readonly CommandCenterItem[] = [
      { id: "command:new-tab", kind: "command", title: "Nova aba", subtitle: "Ctrl+T", keywords: ["criar", "guia"], icon: "plus", action: () => this.#createTab() },
      { id: "command:private", kind: "command", title: "Nova janela anônima", subtitle: "Ctrl+Shift+N", keywords: ["privada", "incognito"], icon: "shield", action: () => this.#bridge?.createPrivateWindow() },
      { id: "command:home", kind: "command", title: "Abrir página inicial", keywords: ["home", "nova aba"], icon: "home", action: () => this.#showHome() },
      { id: "command:settings", kind: "command", title: "Abrir configurações", subtitle: "Ctrl+,", keywords: ["preferências", "personalizar"], icon: "settings", action: () => this.#openSettings() },
      { id: "command:focus", kind: "command", title: this.#focus?.active ? "Encerrar Foco" : "Configurar Foco e Zen", subtitle: "Ctrl+Shift+Z", keywords: ["pomodoro", "concentração"], icon: this.#focus?.active ? "stop" : "play", action: () => { if (this.#focus?.active) this.#focus.end(); else this.#toggleDrawer("focus"); } }
    ];
    const tabs = [...this.#tabs.values()].map(tab => ({ id: `tab:${tab.id}`, kind: "tab" as const, title: tab.title || this.#hostname(tab.url), subtitle: tab.url, keywords: ["aba", "guia"], icon: "globe" as const, action: () => this.#activate(tab.id) }));
    const workspaces = this.#workspaces.map(workspace => ({ id: `workspace:${workspace.id}`, kind: "workspace" as const, title: workspace.name, subtitle: `${[...this.#tabs.values()].filter(tab => (tab.workspaceId ?? "research") === workspace.id).length} abas`, keywords: ["espaço", "contexto"], icon: "grid" as const, action: () => this.#switchWorkspace(workspace.id) }));
    const bookmarks = this.#bookmarks.map(item => ({ id: `bookmark:${item.id}`, kind: "bookmark" as const, title: item.title || this.#hostname(item.url), subtitle: item.url, icon: "star" as const, action: () => this.#navigate(item.url) }));
    const history = this.#history.slice(0, 100).map(item => ({ id: `history:${item.id}`, kind: "history" as const, title: item.title || this.#hostname(item.url), subtitle: item.url, icon: "history" as const, action: () => this.#navigate(item.url) }));
    const settings = SETTINGS_CATALOG.map(item => ({ id: `setting:${item.id}`, kind: "setting" as const, title: item.title, subtitle: item.description, keywords: item.keywords, icon: "settings" as const, action: () => { this.#customization.setExperience("advanced", item.section); return this.#openSettings("modal", item.section); } }));
    return [...commands, ...tabs, ...workspaces, ...bookmarks, ...history, ...settings];
  }

  async #showSettingsPage(section: SettingsSection): Promise<void> {
    if (!this.#bridge || !this.#activeTabId) return;
    this.#settingsCenter?.setPresentation("page"); if (this.#settingsCenter) this.#stage.append(this.#settingsCenter.element);
    this.#settingsReturnHome = true;
    const experience = this.#customization.document.experience;
    await this.#bridge.showInternalPage(this.#activeTabId, this.#settingsUrl(section, experience.mode, experience.view));
  }

  async #ensureSettingsPage(url: string): Promise<void> {
    const state = this.#settingsState(url); this.#customization.setExperience(state.mode, state.section, state.view);
    await this.#openSettings("page", state.section);
  }

  async #navigateSettingsSection(section: SettingsSection, mode: SettingsMode): Promise<void> {
    if (!this.#bridge || !this.#activeTabId) return;
    await this.#bridge.showInternalPage(this.#activeTabId, this.#settingsUrl(section, mode, this.#customization.document.experience.view));
  }

  async #dismissSettings(returnHome: boolean): Promise<void> {
    const center = this.#settingsCenter; if (!center || this.#settingsClosing) return;
    this.#settingsReturnHome = returnHome; this.#settingsClosing = true;
    await center.cancel(); if (this.#settingsCenter === center) this.#settingsClosing = false;
  }

  #settingsState(url: string): { readonly section: SettingsSection; readonly mode: SettingsMode; readonly view: SettingsView } {
    const route = normalizeMoonInternalUrl(url)?.split("/").at(-1);
    if (route === "settings") return { section: "appearance", mode: "simple", view: "section" };
    if (route === "all" || route === "personalize") return { section: "appearance", mode: "advanced", view: "all" };
    const sections: Readonly<Record<string, SettingsSection>> = { appearance: "appearance", themes: "appearance", home: "home", sidebar: "layout", workspaces: "data", search: "search", privacy: "data", advanced: this.#customization.document.experience.lastSection as SettingsSection };
    return { section: sections[route ?? ""] ?? "appearance", mode: "advanced", view: "section" };
  }

  #settingsUrl(section: SettingsSection, mode: SettingsMode, view: SettingsView): string {
    if (mode === "simple") return "moon://settings/settings"; if (view === "all") return "moon://settings/all";
    const route: Readonly<Record<SettingsSection, string>> = { appearance: "appearance", layout: "sidebar", home: "home", typography: "advanced", search: "search", data: "privacy" };
    return `moon://settings/${route[section]}`;
  }
  async #reloadProfileData(): Promise<void> {
    if (!this.#bridge) return;
    const snapshot = await this.#bridge.getProfileData();
    this.#applyProfileData(snapshot);
  }
  async #clearSitePermission(record: SitePermissionRecord): Promise<void> {
    if (!this.#bridge) return;
    try { await this.#bridge.clearSitePermission(record.origin, record.permission); this.#sitePermissions = await this.#bridge.listSitePermissions(); this.#renderDrawer(); }
    catch (error) { this.#showError(error); }
  }
  #applyProfileData(snapshot: ProfileDataSnapshot): void {
    this.#bookmarks = [...snapshot.bookmarks];
    this.#history = [...snapshot.history];
    this.#notes = snapshot.notes;
    if (snapshot.workspaces.length > 0) this.#workspaces = snapshot.workspaces.map(({ id, name }) => ({ id, name }));
    if (!this.#workspaces.some(workspace => workspace.id === this.#workspaceId)) this.#workspaceId = this.#workspaces[0]?.id ?? "research";
    this.#render(); this.#renderDrawer();
  }
  #renderPrivateIdentity(): void {
    document.documentElement.dataset.moonPrivate = this.#windowPrivate ? "on" : "off";
    document.documentElement.dataset.moonGuest = this.#windowGuest ? "on" : "off";
    this.#privateBadge.textContent = this.#windowPrivate ? "ANÔNIMO" : "CONVIDADO";
    this.#privateBadge.hidden = !this.#windowPrivate && !this.#windowGuest;
  }
  #renderProfileIdentity(): void { const profile = this.#activeProfile; this.#profileName.textContent = profile?.name ?? "Moon"; this.#profileName.parentElement?.style.setProperty("--moon-profile-color", profile?.color ?? "var(--moon-user-accent)"); }
  async #mutateProfileData(mutation: ProfileDataMutation): Promise<boolean> {
    if (!this.#bridge) { this.#saveLegacyProjection(mutation); return true; }
    try { await this.#bridge.mutateProfileData(mutation); return true; }
    catch (error) {
      try { await this.#reloadProfileData(); } catch (reloadError) { console.error("Moon profile reload failed", reloadError); }
      this.#showError(error); return false;
    }
  }
  #saveLegacyProjection(mutation: ProfileDataMutation): void {
    if (mutation.type.startsWith("bookmark:")) save(KEYS.bookmarks, this.#bookmarks);
    else if (mutation.type.startsWith("history:")) save(KEYS.history, this.#history);
    else if (mutation.type === "notes:save") save(KEYS.notes, this.#notes);
    else if (mutation.type.startsWith("workspace:")) save(KEYS.workspaces, this.#workspaces);
  }
  async #createWorkspace(name: string): Promise<void> {
    const workspace = { id: `workspace-${Date.now()}`, name };
    this.#workspaces = [...this.#workspaces, workspace];
    const saved = await this.#mutateProfileData({ type: "workspace:save", value: { ...workspace, position: this.#workspaces.length - 1 } });
    if (saved) await this.#switchWorkspace(workspace.id);
  }
  async #removeWorkspace(id: string): Promise<void> {
    this.#workspaces = this.#workspaces.filter(item => item.id !== id);
    if (this.#workspaceId === id) this.#workspaceId = this.#workspaces[0]?.id ?? "research";
    await this.#mutateProfileData({ type: "workspace:delete", id });
    this.#render(); this.#renderDrawer();
  }
  async #removeBookmark(id: string): Promise<void> {
    this.#bookmarks = this.#bookmarks.filter(saved => saved.id !== id);
    await this.#mutateProfileData({ type: "bookmark:delete", id });
    this.#renderDrawer(); this.#render();
  }
  async #clearHistory(): Promise<void> {
    this.#history = [];
    await this.#mutateProfileData({ type: "history:clear" });
    this.#renderDrawer(); this.#refreshHomeData();
  }
  async #saveNotes(status: HTMLElement): Promise<void> {
    this.#notesSaveTimer = undefined;
    const saved = await this.#mutateProfileData({ type: "notes:save", content: this.#notes });
    status.textContent = saved ? "Salvo no perfil" : "Falha ao salvar";
  }
  async #migrateLegacyProfile(): Promise<void> {
    if (!this.#bridge) return;
    const backup = createMoonProfileBackup({ bookmarks: this.#bookmarks, history: this.#history, notes: this.#notes, shortcuts: this.#shortcuts, themes: this.#themes, workspaces: this.#workspaces, preferences: this.#legacyPreferences() });
    const result = await this.#bridge.migrateLegacyProfile(JSON.stringify(backup));
    if (result.version >= 1) save(KEYS.migration, true);
  }
  #legacyPreferences() {
    const config = this.#customization.config;
    const searchEngine = (["duckduckgo", "google", "brave"] as const).find(id => id === config.search.defaultEngine) ?? "duckduckgo";
    const widget = (id: string): boolean => config.home.widgets.find(item => item.id === id)?.visible ?? false;
    const wallpaper = config.appearance.wallpaper.type === "local" && /^\.\/assets\/wallpapers\/[a-z0-9-]+\.svg$/.test(config.appearance.wallpaper.source) ? config.appearance.wallpaper.source : "./assets/wallpapers/aurora.svg";
    return { accent: config.appearance.colors.accent, wallpaper, searchEngine, showClock: widget("clock") || widget("date"), showShortcuts: widget("shortcuts"), glassHome: config.home.cardStyle === "glass" };
  }
  #applyCustomization(config: CustomizationConfig): void {
    this.#customizationApplier.apply(config);
    clearIconOverrides();
    try { installIconOverrides(config.icons.overrides); } catch { clearIconOverrides(); }
    this.#faviconCache.configure(config.favicons);
    if (!config.favicons.enabled) { this.#favicons.clear(); this.#siteFavicons.clear(); this.#renderTabs(); } else for (const tab of this.#tabs.values()) void this.#hydrateFavicon(tab);
    const provider = config.search.providers.find(item => item.id === config.search.defaultEngine); if (provider && this.#bridge?.setSearchTemplate) void this.#bridge.setSearchTemplate(provider.template);
    this.#toolbar.applyLayout(config.layout);
    this.#placeNewTabButton(config.layout.tabs.newTabButton);
    this.#homeView.apply(config);
    this.#refreshHomeData();
    requestAnimationFrame(() => this.#syncBounds());
  }
  async #hydrateFavicon(tab: Tab): Promise<void> {
    const source = tab.faviconUrl; const settings = this.#customization.config.favicons;
    if (!settings.enabled || !source) { this.#favicons.delete(tab.id); return; }
    const cached = this.#faviconCache.get(source); if (cached) { this.#rememberFavicon(tab, cached); return; }
    if (!this.#bridge || this.#pendingFavicons.has(tab.id) || !/^https:\/\//i.test(source)) return;
    const request = this.#bridge.fetchFavicon(source).then(data => {
      if (this.#tabs.get(tab.id)?.faviconUrl !== source) return;
      if (tab.private) { const safe = this.#faviconCache.get(data); if (safe) this.#rememberFavicon(tab, safe); return; }
      if (!this.#faviconCache.set(source, data)) return; this.#rememberFavicon(tab, data);
    }).catch(() => undefined).finally(() => this.#pendingFavicons.delete(tab.id));
    this.#pendingFavicons.set(tab.id, request); await request;
  }
  #rememberFavicon(tab: Tab, data: string): void { this.#favicons.set(tab.id, data); if (!tab.private) { try { this.#siteFavicons.set(new URL(tab.url).origin, data); } catch { /* internal tab */ } } this.#renderTabs(); this.#refreshHomeData(); this.#renderDrawer(); }
  #faviconForUrl(url: string): string | undefined { try { return this.#siteFavicons.get(new URL(url).origin); } catch { return undefined; } }
  #refreshHomeData(): void {
    this.#homeView.updateData({ shortcuts: this.#shortcuts, bookmarks: this.#bookmarks, tabs: [...this.#tabs.values()], workspaces: this.#workspaces, downloads: this.#downloads, notes: this.#notes, favicons: Object.fromEntries(this.#siteFavicons) });
  }
  #placeNewTabButton(position: CustomizationConfig["layout"]["tabs"]["newTabButton"]): void {
    this.#addTab.hidden = position === "hidden"; this.#addTab.classList.toggle("is-end", position === "end-bar");
    if (position === "hidden") { this.#addTab.remove(); return; }
    if (position === "before-tabs") this.#tabStrip.element.before(this.#addTab);
    else if (position === "after-tabs") this.#tabStrip.element.after(this.#addTab);
    else if (position === "end-bar") this.#tabsBar.append(this.#addTab);
    else if (position === "toolbar") this.#toolbar.element.append(this.#addTab);
    else this.#railElement.querySelector(".moon-rail-spacer")?.before(this.#addTab);
  }
  #moveHomeWidget(sourceId: HomeWidgetId, targetId: HomeWidgetId): void {
    this.#customization.update(config => {
      const source = config.home.widgets.find(widget => widget.id === sourceId); const target = config.home.widgets.find(widget => widget.id === targetId); if (!source || !target) return;
      const sourceOrder = source.order; (source as { order: number }).order = target.order; (target as { order: number }).order = sourceOrder; (config.home as { preset: typeof config.home.preset }).preset = "custom";
    });
  }
  #nudgeHomeWidget(id: HomeWidgetId, direction: -1 | 1): void {
    const visible = [...this.#customization.config.home.widgets].filter(widget => widget.visible).sort((left, right) => left.order - right.order); const index = visible.findIndex(widget => widget.id === id); const target = visible[index + direction]; if (target) this.#moveHomeWidget(id, target.id);
  }
  #resizeHomeWidget(id: HomeWidgetId, direction: -1 | 1): void {
    this.#customization.update(config => { const widget = config.home.widgets.find(candidate => candidate.id === id); if (!widget) return; (widget as { columns: 1 | 2 | 3 | 4 }).columns = Math.max(1, Math.min(config.home.columns, widget.columns + direction)) as 1 | 2 | 3 | 4; (config.home as { preset: typeof config.home.preset }).preset = "custom"; });
  }
  #setHomeWidgetVisibility(id: HomeWidgetId, visible: boolean): void {
    this.#customization.update(config => { const widget = config.home.widgets.find(candidate => candidate.id === id); if (!widget) return; (widget as { visible: boolean; order: number }).visible = visible; if (visible) (widget as { order: number }).order = Math.max(...config.home.widgets.map(candidate => candidate.order)) + 1; (config.home as { preset: typeof config.home.preset }).preset = "custom"; });
  }
  #bindDrawerResize(handle: HTMLElement): void {
    handle.addEventListener("pointerdown", event => {
      const startX = event.clientX; const startWidth = this.#customization.config.layout.drawer.width; const direction = document.documentElement.dataset.moonSidebar === "right" ? -1 : 1;
      handle.setPointerCapture(event.pointerId);
      const move = (current: PointerEvent): void => { const width = Math.max(220, Math.min(560, startWidth + (current.clientX - startX) * direction)); this.#customization.set("layout.drawer.width", Math.round(width)); };
      const stop = (current: PointerEvent): void => { handle.releasePointerCapture(current.pointerId); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", stop);
    });
    handle.addEventListener("keydown", event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const direction = document.documentElement.dataset.moonSidebar === "right" ? -1 : 1; const delta = (event.key === "ArrowRight" ? 12 : -12) * direction; this.#customization.set("layout.drawer.width", Math.max(220, Math.min(560, this.#customization.config.layout.drawer.width + delta))); });
  }

  #startClock(): void { this.#homeView.startClock(); }
  #observe(): void { this.#resizeObserver = new ResizeObserver(() => this.#syncBounds()); this.#resizeObserver.observe(this.#viewport); window.addEventListener("resize", () => this.#syncBounds()); }
  #syncBounds(): void { if (!this.#bridge) return; const rect = this.#viewport.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return; void this.#bridge.setBounds({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }).catch(error => this.#showError(error)); }
  #activeWebSurface(): boolean { const active = this.#activeTabId ? this.#tabs.get(this.#activeTabId) : undefined; return Boolean(active && this.#isWeb(active.url)); }
  #bindShortcuts(): void {
    window.addEventListener("keydown", event => {
      if (event.defaultPrevented || this.#onboarding) return;
      const mod = event.ctrlKey || event.metaKey; const key = event.key.toLowerCase();
      if (event.key === "Escape") { if (this.#settingsCenter) void this.#settingsCenter.cancel(); else if (this.#focus?.active) this.#focus.end(); else this.#closeDrawer(); }
      else if (mod && event.key === ",") { event.preventDefault(); void this.#openSettings(); }
      else if (mod && event.shiftKey && key === "z") { event.preventDefault(); if (this.#focus?.active) this.#focus.end(); else this.#toggleDrawer("focus"); }
      else if (mod && event.shiftKey && key === "p") { event.preventDefault(); void this.#openCommandCenter(); }
      else if (mod && key === "tab") { event.preventDefault(); void this.#cycleTab(event.shiftKey ? -1 : 1); }
      else if (mod && event.shiftKey && key === "w") { event.preventDefault(); this.#toggleDrawer("workspaces"); }
      else if (mod && event.shiftKey && key === "n") { event.preventDefault(); void this.#bridge?.createPrivateWindow(); }
      else if (mod && key === "l") { event.preventDefault(); this.#toolbar.focusOmnibox(); }
      else if (mod && key === "k") { event.preventDefault(); this.#homeView.focusSearch(); }
      else if (mod && key === "t") { event.preventDefault(); void this.#createTab(); }
      else if (mod && key === "w" && this.#activeTabId) { event.preventDefault(); void this.#close(this.#activeTabId); }
      else if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); void this.#command("back"); }
      else if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); void this.#command("forward"); }
    });
  }
  async #cycleTab(direction: -1 | 1): Promise<void> { const tabs = this.#workspaceTabs(); if (tabs.length < 2) return; const current = tabs.findIndex(tab => tab.id === this.#activeTabId); const target = tabs[(Math.max(0, current) + direction + tabs.length) % tabs.length]; if (target) await this.#activate(target.id); }
  #isWeb(url: string): boolean { return url.startsWith("https://") || url.startsWith("http://"); }
  #hostname(url: string): string { try { return new URL(url).hostname; } catch { return url; } }
  #flash(message: string): void { this.#status.textContent = message; window.setTimeout(() => { if (this.#status.textContent === message) this.#status.textContent = ""; }, 2200); }
  #showError(error: unknown): void { const message = error instanceof Error ? error.message : String(error); this.#status.textContent = `Moon: ${message}`; console.error(error); }
}

const root = document.querySelector("#moon-root");
if (!(root instanceof HTMLElement)) throw new Error("Moon root was not found");
const app = new MoonApp(root);
app.router.register({ path: "/", title: "Moon Browser", async render(container) { await new BrowserShell(container).start(); } });
app.router.register({ path: "/404", title: "Não encontrado", render(container) { container.textContent = "Página não encontrada"; } });
await app.start();
