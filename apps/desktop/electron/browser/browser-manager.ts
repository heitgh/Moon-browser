import { EXTRACT_PAGE_SCRIPT } from "../../../../packages/research/extract-page.js";
import { researchUrl, parseSources, type ResearchSource } from "../../../../packages/research/research.js";
import { randomUUID } from "node:crypto";
import type {
  BrowserNavigationOptions,
  BrowserTab,
  BrowserTabOptions,
  BrowserWindowOptions
} from "@moon/platform";
import type { ElectronBrowserBackend } from "../../adapters/electron-browser.js";
import type { WindowManager } from "../main/window-manager.js";
import { ElectronBrowserSurface } from "./browser-surface.js";
import { NavigationController } from "./navigation-controller.js";
import type { ElectronAdblockService } from "../services/adblock-service.js";
import type { ElectronDownloadManager } from "../services/download-manager.js";
import type { Session } from "electron";
import { openElectronContextMenu } from "./context-menu.js";
import { isMoonSettingsUrl, MoonInternalHistory, normalizeMoonInternalUrl } from "../../../../packages/navigation/internal-routes.js";
import type { SessionRequestPipeline } from "../security/session-request-pipeline.js";
import type { SitePermissionService } from "../security/site-permission-service.js";
import type { SitePermissionRecord } from "../../../../packages/ipc/site-permission-contract.js";
import { decideWindowOpen, isSafeWebPopupUrl } from "./window-open-policy.js";
import { configureCompatibilityWebContents, isRecoverableRendererExit, navigationFailureMessage } from "./compatibility-policy.js";
import type { ProfileHistoryEntry, ProfileHistoryNavigationType } from "../../../../packages/ipc/profile-data-contract.js";

export interface BrowserNavigationState {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface BrowserTabUpdate {
  readonly tab: BrowserTab;
  readonly navigation: BrowserNavigationState;
  readonly error?: string;
  readonly historyEntry?: ProfileHistoryEntry;
}

export interface BrowserPermissionRequest {
  readonly id: string;
  readonly origin: string;
  readonly permission: string;
}

export class ElectronBrowserManager implements ElectronBrowserBackend {
  readonly #surfaces = new Map<string, ElectronBrowserSurface>();
  readonly #tabs = new Map<string, BrowserTab>();
  readonly #tabWindows = new Map<string, string>();
  readonly #homeTabs = new Set<string>();
  readonly #internalHistory = new Map<string, MoonInternalHistory>();
  readonly #activeTabs = new Map<string, string>();
  readonly #bounds = new Map<string, Electron.Rectangle>();
  readonly #contentVisible = new Map<string, boolean>();
  readonly #searchTemplates = new Map<string, string>();
  readonly #permissionSessions = new WeakSet<Session>();
  readonly #htmlFullscreenTabs = new Map<string, string>();
  readonly #fullscreenWindowCleanup = new Map<string, () => void>();
  readonly #auxiliaryWindows = new Map<number, { readonly tabId: string; readonly window: Electron.BrowserWindow }>();
  readonly #historyCandidates = new Map<string, { readonly startedAt: number; readonly navigationType: ProfileHistoryNavigationType }>();
  readonly #recoveryAttempts = new Map<string, number>();
  readonly #recoveryTimers = new Map<string, NodeJS.Timeout>();
  readonly #nextNavigationTypes = new Map<string, ProfileHistoryNavigationType>();
  readonly #permissionRequests = new Map<string, {
    readonly windowId: string;
    readonly origin: string;
    readonly permission: string;
    readonly session: Session;
    readonly private: boolean;
    readonly callback: (granted: boolean) => void;
    readonly timeout: NodeJS.Timeout;
  }>();
  readonly #privatePermissions = new WeakMap<Session, Map<string, "allow" | "deny">>();
  readonly #tabUpdateListeners = new Set<(windowId: string, update: BrowserTabUpdate) => void | Promise<void>>();

  constructor(
    readonly windows: WindowManager,
    readonly downloads?: ElectronDownloadManager,
    readonly adblock?: ElectronAdblockService,
    readonly requestPipeline?: SessionRequestPipeline,
    readonly permissionsForWindow?: (windowId: string) => SitePermissionService | undefined
  ) {}

  async readResearchSource(tabId: string, windowId: string): Promise<ResearchSource> {
    const tab = this.#tabs.get(tabId);
    if (!tab || this.#tabWindows.get(tabId) !== windowId || tab.private || this.windows.isPrivate(windowId)) throw new Error("Aba indisponível para pesquisa.");
    const contents = this.#surfaces.get(tabId)?.view.webContents;
    if (!contents || contents.isDestroyed()) throw new Error("Abra uma página antes de pesquisar.");
    const url = researchUrl(contents.getURL());
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const read = contents.executeJavaScriptInIsolatedWorld(1001, [{ code: EXTRACT_PAGE_SCRIPT }]);
    try {
      const data: unknown = await Promise.race([read, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("A leitura excedeu 5 segundos. Tente novamente.")), 5000); })]);
      if (contents.isDestroyed() || contents.getURL() !== url) throw new Error("A página mudou durante a leitura. Selecione novamente.");
      return parseSources([{ ...(data as object), tabId, url, title: contents.getTitle() }])[0]!;
    } finally { if (timeout) clearTimeout(timeout); }
  }

  onTabUpdated(listener: (windowId: string, update: BrowserTabUpdate) => void | Promise<void>): () => void {
    this.#tabUpdateListeners.add(listener);
    return () => this.#tabUpdateListeners.delete(listener);
  }

  async createWindow(options?: BrowserWindowOptions): Promise<string> {
    return this.windows.create(options);
  }

  async closeWindow(id: string): Promise<void> {
    await this.closeTabsForWindow(id);
    this.windows.close(id);
  }

  async focusWindow(id: string): Promise<void> { this.windows.focus(id); }

  async createTab(windowId: string, options: BrowserTabOptions = {}): Promise<BrowserTab> {
    const id = options.id ?? randomUUID();
    if (this.#tabs.has(id)) throw new Error(`Tab already exists: ${id}`);
    const sessionId = options.private ? options.sessionId ?? id : options.sessionId;

    const window = this.windows.require(windowId);
    const profileId = this.windows.profileId(windowId);
    const guest = this.windows.isGuest(windowId);
    const surface = new ElectronBrowserSurface(`surface-${id}`, id, window, {
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        disableHtmlFullscreenWindowResize: true,
        partition: options.private
          ? `private:${profileId}:${sessionId}`
          : guest
            ? `guest:${profileId}:${options.workspaceId ?? "default"}`
          : options.workspaceId
            ? `persist:profile:${profileId}:workspace:${options.workspaceId}`
            : `persist:profile:${profileId}:default`
      }
    });
    this.downloads?.attach(surface.view.webContents.session, profileId);
    this.requestPipeline?.attach(surface.view.webContents.session);
    configureCompatibilityWebContents(surface.view.webContents);
    this.#installPermissionHandler(surface.view.webContents.session);

    const requestedUrl = options.url ?? "moon://newtab";
    const internalUrl = normalizeMoonInternalUrl(requestedUrl); const isHome = internalUrl !== null;
    const tab: BrowserTab = {
      id,
      url: internalUrl ?? requestedUrl,
      title: internalUrl ? this.#internalTitle(internalUrl) : "Carregando…",
      active: false,
      loading: !isHome,
      workspaceId: options.workspaceId,
      sessionId,
      private: options.private ?? false
    };

    this.#surfaces.set(id, surface);
    this.#tabs.set(id, tab);
    this.#tabWindows.set(id, windowId);
    if (isHome) { this.#homeTabs.add(id); this.#internalHistory.set(id, new MoonInternalHistory(internalUrl!)); }
    this.#attachWebContentsEvents(id, windowId, surface);
    this.#installFullscreenWindowListener(windowId);

    const bounds = this.#bounds.get(windowId);
    if (bounds) surface.setBounds(bounds);

    let initialNavigationError: string | undefined;
    if (!isHome) {
      try {
        this.#nextNavigationTypes.set(id, "generated");
        await new NavigationController(surface.view.webContents).navigate(requestedUrl);
      } catch (error) {
        initialNavigationError = error instanceof Error ? error.message : String(error);
        this.#replaceTab(id, { loading: false, title: "Falha ao carregar" });
      }
    } else {
      await surface.view.webContents.loadURL("about:blank");
    }

    if (options.active !== false || !this.#activeTabs.has(windowId)) await this.activateTab(id);
    this.#emitUpdate(id, initialNavigationError);
    return this.#requireTab(id);
  }

  async closeTab(id: string): Promise<void> {
    const windowId = this.#requireWindowId(id);
    if (this.#htmlFullscreenTabs.get(windowId) === id) this.#leaveHtmlFullscreen(id, windowId);
    this.#closeAuxiliaryWindows(id);
    const wasActive = this.#activeTabs.get(windowId) === id;
    const remaining = [...this.#tabs.keys()].filter(
      tabId => tabId !== id && this.#tabWindows.get(tabId) === windowId
    );

    this.#requireSurface(id).destroy();
    this.#surfaces.delete(id);
    this.#tabs.delete(id);
    this.#tabWindows.delete(id);
    this.#homeTabs.delete(id);
    this.#internalHistory.delete(id);
    this.#historyCandidates.delete(id);
    this.#nextNavigationTypes.delete(id);
    this.#recoveryAttempts.delete(id);
    const recoveryTimer = this.#recoveryTimers.get(id);
    if (recoveryTimer) clearTimeout(recoveryTimer);
    this.#recoveryTimers.delete(id);
    if (wasActive) this.#activeTabs.delete(windowId);

    const host = this.windows.get(windowId);
    if (host && !host.webContents.isDestroyed()) {
      host.webContents.send("browser:tab-closed", { tabId: id });
    }

    if (wasActive && remaining.length > 0) await this.activateTab(remaining.at(-1)!);
  }

  async activateTab(id: string): Promise<void> {
    const windowId = this.#requireWindowId(id);
    const fullscreenTabId = this.#htmlFullscreenTabs.get(windowId);
    if (fullscreenTabId && fullscreenTabId !== id) await this.#exitHtmlFullscreen(fullscreenTabId, windowId);
    this.#activeTabs.set(windowId, id);

    for (const [tabId, surface] of this.#surfaces) {
      if (this.#tabWindows.get(tabId) !== windowId) continue;
      const active = tabId === id;
      this.#replaceTab(tabId, { active });
      surface.setVisible(
        active &&
        !this.#homeTabs.has(tabId) &&
        this.#contentVisible.get(windowId) !== false
      );
      this.#emitUpdate(tabId);
    }

    if (!this.#homeTabs.has(id)) this.#requireSurface(id).focus();
  }

  async showHome(id: string): Promise<void> {
    await this.showInternalPage(id, "moon://newtab");
  }

  async showInternalPage(id: string, input: string, push = true): Promise<void> {
    const windowId = this.#requireWindowId(id);
    if (this.#htmlFullscreenTabs.get(windowId) === id) await this.#exitHtmlFullscreen(id, windowId);
    this.#historyCandidates.delete(id); this.#nextNavigationTypes.delete(id);
    const url = normalizeMoonInternalUrl(input); if (!url) throw new TypeError("Rota interna do Moon inválida.");
    this.#homeTabs.add(id); this.#replaceTab(id, { url, title: this.#internalTitle(url), loading: false, faviconUrl: "" }); this.#requireSurface(id).setVisible(false);
    const history = this.#internalHistory.get(id) ?? new MoonInternalHistory();
    if (push) history.push(url);
    this.#internalHistory.set(id, history); this.#emitUpdate(id);
  }

  async navigate(id: string, url: string, _options?: BrowserNavigationOptions): Promise<void> {
    if (normalizeMoonInternalUrl(url)) return this.showInternalPage(id, url);
    const windowId = this.#requireWindowId(id);
    if (this.#htmlFullscreenTabs.get(windowId) === id) await this.#exitHtmlFullscreen(id, windowId);
    this.#homeTabs.delete(id);
    this.#internalHistory.delete(id);
    this.#nextNavigationTypes.set(id, "typed");
    this.#replaceTab(id, { url, title: "Carregando…", loading: true, faviconUrl: "" });
    if (
      this.#requireTab(id).active &&
      this.#contentVisible.get(this.#requireWindowId(id)) !== false
    ) {
      this.#requireSurface(id).setVisible(true);
    }
    this.#emitUpdate(id);
    await new NavigationController(this.#requireSurface(id).view.webContents).navigate(url);
  }

  async goBack(id: string): Promise<void> {
    const internal = this.#internalHistory.get(id); const target = this.#homeTabs.has(id) ? internal?.back() : undefined; if (target) { await this.showInternalPage(id, target, false); return; }
    this.#nextNavigationTypes.set(id, "history"); new NavigationController(this.#requireSurface(id).view.webContents).back();
  }

  async goForward(id: string): Promise<void> {
    const internal = this.#internalHistory.get(id); const target = this.#homeTabs.has(id) ? internal?.forward() : undefined; if (target) { await this.showInternalPage(id, target, false); return; }
    this.#nextNavigationTypes.set(id, "history"); new NavigationController(this.#requireSurface(id).view.webContents).forward();
  }

  async reload(id: string, bypassCache?: boolean): Promise<void> {
    if (this.#homeTabs.has(id)) return;
    this.#nextNavigationTypes.set(id, "reload");
    new NavigationController(this.#requireSurface(id).view.webContents).reload(bypassCache);
  }

  async stopLoading(id: string): Promise<void> {
    new NavigationController(this.#requireSurface(id).view.webContents).stop();
  }

  async getTab(id: string): Promise<BrowserTab | null> { return this.#tabs.get(id) ?? null; }

  async getTabs(windowId: string): Promise<readonly BrowserTab[]> {
    return [...this.#tabs.entries()]
      .filter(([id]) => this.#tabWindows.get(id) === windowId)
      .map(([, tab]) => tab);
  }

  windowIds(): readonly string[] {
    return [...new Set(this.#tabWindows.values())];
  }

  setBounds(windowId: string, bounds: Electron.Rectangle): void {
    if (this.#htmlFullscreenTabs.has(windowId)) return;
    const window = this.windows.require(windowId);
    const content = window.getContentBounds();
    const safeBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(1, Math.min(Math.round(bounds.width), content.width)),
      height: Math.max(1, Math.min(Math.round(bounds.height), content.height))
    };
    this.#bounds.set(windowId, safeBounds);
    for (const [tabId, surface] of this.#surfaces) {
      if (this.#tabWindows.get(tabId) === windowId) surface.setBounds(safeBounds);
    }
  }

  setContentVisible(windowId: string, visible: boolean): void {
    if (!visible) {
      const fullscreenTabId = this.#htmlFullscreenTabs.get(windowId);
      if (fullscreenTabId) void this.#exitHtmlFullscreen(fullscreenTabId, windowId);
    }
    this.#contentVisible.set(windowId, visible);
    const activeTabId = this.#activeTabs.get(windowId);
    for (const [tabId, surface] of this.#surfaces) {
      if (this.#tabWindows.get(tabId) !== windowId) continue;
      surface.setVisible(
        visible && tabId === activeTabId && !this.#homeTabs.has(tabId)
      );
    }
  }

  setSearchTemplate(windowId: string, template: string): void {
    if (template.length > 2_048 || !template.includes("{query}")) throw new TypeError("Invalid search template");
    const probe = new URL(template.replace("{query}", "moon")); if (probe.protocol !== "https:" || probe.username || probe.password) throw new TypeError("Search template must use HTTPS");
    this.#searchTemplates.set(windowId, template);
  }

  ownsTab(tabId: string, windowId: string): boolean {
    return this.#tabWindows.get(tabId) === windowId;
  }

  async respondToPermission(windowId: string, requestId: string, granted: boolean): Promise<void> {
    const request = this.#permissionRequests.get(requestId);
    if (!request || request.windowId !== windowId) throw new Error("Permission request not found");
    clearTimeout(request.timeout);
    this.#permissionRequests.delete(requestId);
    const decision = granted ? "allow" : "deny";
    try {
      if (request.private) {
        const records = this.#privatePermissions.get(request.session) ?? new Map<string, "allow" | "deny">();
        records.set(this.#permissionKey(request.origin, request.permission), decision); this.#privatePermissions.set(request.session, records);
      } else await this.permissionsForWindow?.(windowId)?.set(request.origin, request.permission, decision);
    } catch (error) {
      request.callback(false);
      throw error;
    }
    request.callback(granted);
  }

  listPermissions(windowId: string): readonly SitePermissionRecord[] { return this.permissionsForWindow?.(windowId)?.list() ?? []; }
  clearPermission(windowId: string, origin: string, permission: string): Promise<void> { return this.permissionsForWindow?.(windowId)?.clear(origin, permission) ?? Promise.resolve(); }

  async closeTabsForWindow(windowId: string): Promise<void> {
    const ids = [...this.#tabs.keys()].filter(id => this.#tabWindows.get(id) === windowId);
    const privateSessions = new Set<Session>();
    for (const id of ids) {
      this.#closeAuxiliaryWindows(id);
      const surface = this.#surfaces.get(id);
      if (surface && this.#tabs.get(id)?.private) privateSessions.add(surface.view.webContents.session);
      surface?.destroy();
      this.#surfaces.delete(id);
      this.#tabs.delete(id);
      this.#tabWindows.delete(id);
      this.#homeTabs.delete(id);
      this.#internalHistory.delete(id);
      this.#historyCandidates.delete(id);
      this.#nextNavigationTypes.delete(id);
    }
    this.#activeTabs.delete(windowId);
    this.#bounds.delete(windowId);
    this.#contentVisible.delete(windowId);
    this.#searchTemplates.delete(windowId);
    this.#htmlFullscreenTabs.delete(windowId);
    this.#fullscreenWindowCleanup.get(windowId)?.();
    this.#fullscreenWindowCleanup.delete(windowId);
    for (const [requestId, request] of this.#permissionRequests) {
      if (request.windowId !== windowId) continue;
      clearTimeout(request.timeout);
      request.callback(false);
      this.#permissionRequests.delete(requestId);
    }
    await Promise.all([...privateSessions].map(async session => {
      await Promise.all([session.clearCache(), session.clearStorageData()]);
      this.#privatePermissions.delete(session);
    }));
  }

  async executeScript(id: string, script: string): Promise<unknown> {
    return this.#requireSurface(id).view.webContents.executeJavaScript(script, true);
  }

  async capturePage(id: string): Promise<Uint8Array> {
    const image = await this.#requireSurface(id).view.webContents.capturePage();
    return image.toPNG();
  }

  async destroy(): Promise<void> {
    for (const windowId of new Set(this.#tabWindows.values())) {
      await this.closeTabsForWindow(windowId);
    }
    this.windows.closeAll();
  }

  #attachWebContentsEvents(
    id: string,
    windowId: string,
    surface: ElectronBrowserSurface
  ): void {
    const contents = surface.view.webContents;

    this.#installWindowOpenHandler(id, windowId, contents);
    contents.on("context-menu", (_event, params) => {
      const tab = this.#requireTab(id); const window = this.windows.get(windowId); if (!window || contents.isDestroyed()) return;
      openElectronContextMenu({ windowId, window, contents, params, tab: { id, workspaceId: tab.workspaceId, sessionId: tab.sessionId, private: tab.private }, searchUrl: selection => (this.#searchTemplates.get(windowId) ?? "https://duckduckgo.com/?q={query}").replace("{query}", encodeURIComponent(selection)), createTab: (url, source) => this.createTab(windowId, { url, active: true, workspaceId: source.workspaceId, sessionId: source.sessionId, private: source.private }), navigate: (tabId, url) => this.navigate(tabId, url) });
    });

    contents.on("will-navigate", event => {
      const protocol = new URL(event.url).protocol;
      if (protocol !== "http:" && protocol !== "https:") event.preventDefault();
    });
    contents.on("did-start-loading", () => {
      this.#replaceTab(id, { loading: true });
      this.#emitUpdate(id);
    });
    contents.on("did-stop-loading", () => {
      this.#recoveryAttempts.delete(id);
      this.#replaceTab(id, { loading: false });
      this.#syncFromContents(id, this.#completeHistoryEntry(id, windowId));
    });
    contents.on("did-navigate", (_event, url) => {
      if (!this.#homeTabs.has(id)) this.#replaceTab(id, { url });
      if (!this.#requireTab(id).private && /^https?:\/\//i.test(url)) this.#historyCandidates.set(id, { startedAt: Date.now(), navigationType: this.#nextNavigationTypes.get(id) ?? "link" });
      this.#nextNavigationTypes.delete(id);
      this.#emitUpdate(id);
    });
    contents.on("did-navigate-in-page", (_event, url) => {
      this.#replaceTab(id, { url });
      this.#emitUpdate(id);
    });
    contents.on("page-title-updated", (_event, title) => {
      this.#replaceTab(id, { title: title.trim() || "Nova guia" });
      this.#emitUpdate(id);
    });
    contents.on("page-favicon-updated", (_event, favicons) => {
      const faviconUrl = favicons.find(url => /^https:\/\//i.test(url) || /^data:image\//i.test(url)); if (!faviconUrl) return;
      this.#replaceTab(id, { faviconUrl }); this.#emitUpdate(id);
    });
    contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
      if (errorCode === -3) return;
      this.#historyCandidates.delete(id);
      this.#replaceTab(id, { loading: false, url: validatedUrl || this.#requireTab(id).url });
      this.#emitUpdate(id, navigationFailureMessage(errorCode));
    });
    contents.on("render-process-gone", (_event, details) => {
      if (this.#htmlFullscreenTabs.get(windowId) === id) this.#leaveHtmlFullscreen(id, windowId);
      this.#recoverPage(id, windowId, details.reason);
    });
    contents.on("unresponsive", () => this.#recoverPage(id, windowId, "unresponsive"));
    contents.on("responsive", () => this.#recoveryAttempts.delete(id));
    contents.on("enter-html-full-screen", () => this.#enterHtmlFullscreen(id, windowId));
    contents.on("leave-html-full-screen", () => this.#leaveHtmlFullscreen(id, windowId));
  }

  #installWindowOpenHandler(id: string, windowId: string, contents: Electron.WebContents): void {
    contents.setWindowOpenHandler(details => {
      const decision = decideWindowOpen(details.url, details.disposition, { features: details.features, frameName: details.frameName });
      if (decision.action === "deny") return { action: "deny" };
      if (decision.action === "tab") {
        const source = this.#tabs.get(id); if (!source) return { action: "deny" };
        void this.createTab(windowId, { url: details.url, active: decision.active, workspaceId: source.workspaceId, sessionId: source.sessionId, private: source.private }).catch(() => undefined);
        return { action: "deny" };
      }
      const parent = this.windows.get(windowId); if (!parent) return { action: "deny" };
      return {
        action: "allow",
        outlivesOpener: false,
        overrideBrowserWindowOptions: {
          parent, width: 520, height: 720, minWidth: 360, minHeight: 480, show: false, autoHideMenuBar: true,
          title: "Autenticação — Moon Browser", backgroundColor: "#090a10",
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false, session: contents.session }
        }
      };
    });
    contents.on("did-create-window", popup => {
      this.#auxiliaryWindows.set(popup.id, { tabId: id, window: popup });
      popup.setMenuBarVisibility(false);
      this.downloads?.attach(popup.webContents.session, this.windows.profileId(windowId));
      this.requestPipeline?.attach(popup.webContents.session);
      this.#installPermissionHandler(popup.webContents.session);
      this.#installWindowOpenHandler(id, windowId, popup.webContents);
      const keepPopupOnWeb = (event: Electron.Event & { readonly url: string }): void => { if (!isSafeWebPopupUrl(event.url)) event.preventDefault(); };
      popup.webContents.on("will-navigate", keepPopupOnWeb);
      popup.webContents.on("will-redirect", keepPopupOnWeb);
      popup.once("ready-to-show", () => { if (!popup.isDestroyed()) popup.show(); });
      popup.once("closed", () => { this.#auxiliaryWindows.delete(popup.id); });
    });
  }

  #recoverPage(id: string, windowId: string, reason: string): void {
    const surface = this.#surfaces.get(id);
    if (!surface || surface.view.webContents.isDestroyed()) return;
    const attempts = (this.#recoveryAttempts.get(id) ?? 0) + 1;
    this.#recoveryAttempts.set(id, attempts);
    const previousTimer = this.#recoveryTimers.get(id);
    if (previousTimer) clearTimeout(previousTimer);
    this.#replaceTab(id, { loading: false });
    if (!isRecoverableRendererExit(reason) && reason !== "unresponsive") {
      this.#emitUpdate(id, "A página foi interrompida. Recarregue para tentar novamente.");
      return;
    }
    if (attempts > 2) {
      this.#emitUpdate(id, "A página continua instável. Feche outras abas e tente recarregar.");
      return;
    }
    this.#emitUpdate(id, attempts === 1 ? "A página parou de responder. O Moon está recuperando a aba…" : "A página travou novamente. Fazendo a última tentativa de recuperação…");
    const timer = setTimeout(() => {
      this.#recoveryTimers.delete(id);
      const current = this.#surfaces.get(id)?.view.webContents;
      if (!current || current.isDestroyed()) return;
      current.reload();
    }, attempts * 350);
    this.#recoveryTimers.set(id, timer);
  }

  #closeAuxiliaryWindows(tabId: string): void {
    for (const [id, auxiliary] of this.#auxiliaryWindows) {
      if (auxiliary.tabId !== tabId) continue;
      this.#auxiliaryWindows.delete(id);
      if (!auxiliary.window.isDestroyed()) auxiliary.window.close();
    }
  }

  #installFullscreenWindowListener(windowId: string): void {
    if (this.#fullscreenWindowCleanup.has(windowId)) return;
    const window = this.windows.require(windowId);
    const resize = (): void => { const tabId = this.#htmlFullscreenTabs.get(windowId); if (tabId) this.#applyFullscreenBounds(tabId, windowId); };
    window.on("resize", resize);
    const cleanup = (): void => { window.removeListener("resize", resize); };
    this.#fullscreenWindowCleanup.set(windowId, cleanup);
    window.once("closed", () => { cleanup(); this.#fullscreenWindowCleanup.delete(windowId); this.#htmlFullscreenTabs.delete(windowId); });
  }

  #enterHtmlFullscreen(id: string, windowId: string): void {
    if (this.#activeTabs.get(windowId) !== id) { void this.#exitHtmlFullscreen(id, windowId); return; }
    const previous = this.#htmlFullscreenTabs.get(windowId); if (previous && previous !== id) void this.#exitHtmlFullscreen(previous, windowId);
    this.#htmlFullscreenTabs.set(windowId, id); this.#applyFullscreenBounds(id, windowId); this.#sendFullscreenState(windowId, id, true);
  }

  #leaveHtmlFullscreen(id: string, windowId: string): void {
    if (this.#htmlFullscreenTabs.get(windowId) !== id) return;
    this.#htmlFullscreenTabs.delete(windowId);
    const surface = this.#surfaces.get(id); const bounds = this.#bounds.get(windowId); if (surface && bounds) surface.setBounds(bounds);
    this.#sendFullscreenState(windowId, id, false);
  }

  async #exitHtmlFullscreen(id: string, windowId: string): Promise<void> {
    this.#leaveHtmlFullscreen(id, windowId);
    const contents = this.#surfaces.get(id)?.view.webContents; if (!contents || contents.isDestroyed()) return;
    await contents.executeJavaScript("document.fullscreenElement ? document.exitFullscreen() : undefined", true).catch(() => undefined);
  }

  #applyFullscreenBounds(id: string, windowId: string): void {
    const window = this.windows.get(windowId); const surface = this.#surfaces.get(id); if (!window || !surface) return;
    const [width, height] = window.getContentSize(); surface.setBounds({ x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) }); surface.setVisible(true); surface.focus();
  }

  #sendFullscreenState(windowId: string, tabId: string, active: boolean): void {
    const host = this.windows.get(windowId); if (!host || host.webContents.isDestroyed()) return;
    host.webContents.send("browser:fullscreen-changed", { tabId, active });
  }

  #installPermissionHandler(session: Session): void {
    if (this.#permissionSessions.has(session)) return;
    this.#permissionSessions.add(session);
    session.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
      if (["clipboard-sanitized-write", "fullscreen"].includes(permission)) return true;
      const origin = this.#permissionOrigin(requestingOrigin || contents?.getURL()); if (!origin) return false;
      const tab = contents ? this.#tabForContents(contents.id) : undefined;
      const windowId = tab ? this.#tabWindows.get(tab.id) : undefined;
      const decision = tab?.private ? this.#privatePermissions.get(session)?.get(this.#permissionKey(origin, permission)) : windowId ? this.permissionsForWindow?.(windowId)?.get(origin, permission) : undefined;
      return decision === "allow";
    });
    session.setPermissionRequestHandler((contents, permission, callback) => {
      const surfaceEntry = [...this.#surfaces.entries()].find(([, surface]) => surface.view.webContents.id === contents.id);
      const windowId = surfaceEntry ? this.#tabWindows.get(surfaceEntry[0]) : undefined;
      const tab = surfaceEntry ? this.#tabs.get(surfaceEntry[0]) : undefined;
      const host = windowId ? this.windows.get(windowId) : undefined;
      if (!windowId || !host || host.webContents.isDestroyed()) {
        callback(false);
        return;
      }
      const origin = this.#permissionOrigin(contents.getURL()); if (!origin) { callback(false); return; }
      const cached = tab?.private ? this.#privatePermissions.get(session)?.get(this.#permissionKey(origin, permission)) : this.permissionsForWindow?.(windowId)?.get(origin, permission);
      if (cached) { callback(cached === "allow"); return; }
      const id = randomUUID();
      const timeout = setTimeout(() => {
        const pending = this.#permissionRequests.get(id);
        if (!pending) return;
        this.#permissionRequests.delete(id);
        pending.callback(false);
      }, 30_000);
      this.#permissionRequests.set(id, { windowId, origin, permission, session, private: tab?.private === true, callback, timeout });
      const request: BrowserPermissionRequest = { id, origin, permission };
      host.webContents.send("browser:permission-requested", request);
    });
  }

  #tabForContents(contentsId: number): BrowserTab | undefined { const entry = [...this.#surfaces.entries()].find(([, surface]) => surface.view.webContents.id === contentsId); return entry ? this.#tabs.get(entry[0]) : undefined; }
  #permissionOrigin(value: string | undefined): string | undefined { try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) ? url.origin : undefined; } catch { return undefined; } }
  #permissionKey(origin: string, permission: string): string { return `${origin}\0${permission}`; }

  #syncFromContents(id: string, historyEntry?: ProfileHistoryEntry): void {
    const contents = this.#requireSurface(id).view.webContents;
    if (this.#homeTabs.has(id)) {
      const url = this.#requireTab(id).url; this.#replaceTab(id, { url, title: this.#internalTitle(url), loading: false });
      this.#emitUpdate(id);
      return;
    }
    this.#replaceTab(id, {
      url: contents.getURL() || this.#requireTab(id).url,
      title: contents.getTitle().trim() || this.#requireTab(id).title,
      loading: contents.isLoading()
    });
    this.#emitUpdate(id, undefined, historyEntry);
  }

  #completeHistoryEntry(id: string, windowId: string): ProfileHistoryEntry | undefined {
    const candidate = this.#historyCandidates.get(id); this.#historyCandidates.delete(id); if (!candidate) return undefined;
    const tab = this.#requireTab(id); const contents = this.#requireSurface(id).view.webContents; const endedAt = Date.now(); const url = contents.getURL() || tab.url; const title = contents.getTitle().trim() || tab.title || url; const faviconUrl = tab.faviconUrl && /^https:\/\//i.test(tab.faviconUrl) ? tab.faviconUrl : undefined;
    return { schemaVersion: 2, id: randomUUID(), title, url, time: candidate.startedAt, startedAt: candidate.startedAt, endedAt, durationMs: Math.max(0, endedAt - candidate.startedAt), ...(faviconUrl ? { faviconUrl } : {}), profileId: this.windows.profileId(windowId), ...(tab.workspaceId ? { workspaceId: tab.workspaceId } : {}), ...(tab.sessionId ? { sessionId: tab.sessionId } : {}), tabId: id, source: "navigation", navigationType: candidate.navigationType };
  }

  #emitUpdate(id: string, error?: string, historyEntry?: ProfileHistoryEntry): void {
    const tab = this.#tabs.get(id);
    const windowId = this.#tabWindows.get(id);
    const surface = this.#surfaces.get(id);
    if (!tab || !windowId || !surface) return;
    const host = this.windows.get(windowId);
    if (!host || host.webContents.isDestroyed()) return;
    const navigation = surface.view.webContents.navigationHistory; const internal = this.#internalHistory.get(id); const isInternal = this.#homeTabs.has(id);
    const update: BrowserTabUpdate = {
      tab,
      navigation: {
        canGoBack: isInternal ? Boolean(internal?.canGoBack) : navigation.canGoBack(),
        canGoForward: isInternal ? Boolean(internal?.canGoForward) : navigation.canGoForward()
      },
      ...(error ? { error } : {}),
      ...(historyEntry ? { historyEntry } : {})
    };
    host.webContents.send("browser:tab-updated", update);
    for (const listener of this.#tabUpdateListeners) {
      void Promise.resolve(listener(windowId, update)).catch(error => console.error("Tab update listener failed", error));
    }
  }

  #replaceTab(id: string, patch: Partial<BrowserTab>): void {
    this.#tabs.set(id, { ...this.#requireTab(id), ...patch });
  }

  #internalTitle(url: string): string { return isMoonSettingsUrl(url) ? "Configurações" : "Nova guia"; }

  #requireTab(id: string): BrowserTab {
    const tab = this.#tabs.get(id);
    if (!tab) throw new Error(`Tab not found: ${id}`);
    return tab;
  }

  #requireWindowId(id: string): string {
    const windowId = this.#tabWindows.get(id);
    if (!windowId) throw new Error(`Window for tab not found: ${id}`);
    return windowId;
  }

  #requireSurface(id: string): ElectronBrowserSurface {
    const surface = this.#surfaces.get(id);
    if (!surface) throw new Error(`Tab surface not found: ${id}`);
    return surface;
  }
}
