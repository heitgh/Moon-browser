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

export interface BrowserNavigationState {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface BrowserTabUpdate {
  readonly tab: BrowserTab;
  readonly navigation: BrowserNavigationState;
  readonly error?: string;
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
  readonly #permissionRequests = new Map<string, {
    readonly windowId: string;
    readonly callback: (granted: boolean) => void;
    readonly timeout: NodeJS.Timeout;
  }>();
  readonly #tabUpdateListeners = new Set<(windowId: string, update: BrowserTabUpdate) => void | Promise<void>>();

  constructor(
    readonly windows: WindowManager,
    readonly downloads?: ElectronDownloadManager,
    readonly adblock?: ElectronAdblockService
  ) {}

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
    const surface = new ElectronBrowserSurface(`surface-${id}`, id, window, {
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: options.private
          ? `private:${sessionId}`
          : options.workspaceId
            ? `persist:workspace:${options.workspaceId}`
            : "persist:default"
      }
    });
    this.downloads?.attach(surface.view.webContents.session);
    this.adblock?.attach(surface.view.webContents.session);
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

    const bounds = this.#bounds.get(windowId);
    if (bounds) surface.setBounds(bounds);

    let initialNavigationError: string | undefined;
    if (!isHome) {
      try {
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
    if (wasActive) this.#activeTabs.delete(windowId);

    const host = this.windows.get(windowId);
    if (host && !host.webContents.isDestroyed()) {
      host.webContents.send("browser:tab-closed", { tabId: id });
    }

    if (wasActive && remaining.length > 0) await this.activateTab(remaining.at(-1)!);
  }

  async activateTab(id: string): Promise<void> {
    const windowId = this.#requireWindowId(id);
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
    const url = normalizeMoonInternalUrl(input); if (!url) throw new TypeError("Rota interna do Moon inválida.");
    this.#homeTabs.add(id); this.#replaceTab(id, { url, title: this.#internalTitle(url), loading: false, faviconUrl: "" }); this.#requireSurface(id).setVisible(false);
    const history = this.#internalHistory.get(id) ?? new MoonInternalHistory();
    if (push) history.push(url);
    this.#internalHistory.set(id, history); this.#emitUpdate(id);
  }

  async navigate(id: string, url: string, _options?: BrowserNavigationOptions): Promise<void> {
    if (normalizeMoonInternalUrl(url)) return this.showInternalPage(id, url);
    this.#homeTabs.delete(id);
    this.#internalHistory.delete(id);
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
    new NavigationController(this.#requireSurface(id).view.webContents).back();
  }

  async goForward(id: string): Promise<void> {
    const internal = this.#internalHistory.get(id); const target = this.#homeTabs.has(id) ? internal?.forward() : undefined; if (target) { await this.showInternalPage(id, target, false); return; }
    new NavigationController(this.#requireSurface(id).view.webContents).forward();
  }

  async reload(id: string, bypassCache?: boolean): Promise<void> {
    if (this.#homeTabs.has(id)) return;
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

  respondToPermission(windowId: string, requestId: string, granted: boolean): void {
    const request = this.#permissionRequests.get(requestId);
    if (!request || request.windowId !== windowId) throw new Error("Permission request not found");
    clearTimeout(request.timeout);
    this.#permissionRequests.delete(requestId);
    request.callback(granted);
  }

  async closeTabsForWindow(windowId: string): Promise<void> {
    const ids = [...this.#tabs.keys()].filter(id => this.#tabWindows.get(id) === windowId);
    for (const id of ids) {
      const surface = this.#surfaces.get(id);
      surface?.destroy();
      this.#surfaces.delete(id);
      this.#tabs.delete(id);
      this.#tabWindows.delete(id);
      this.#homeTabs.delete(id);
      this.#internalHistory.delete(id);
    }
    this.#activeTabs.delete(windowId);
    this.#bounds.delete(windowId);
    this.#contentVisible.delete(windowId);
    this.#searchTemplates.delete(windowId);
    for (const [requestId, request] of this.#permissionRequests) {
      if (request.windowId !== windowId) continue;
      clearTimeout(request.timeout);
      request.callback(false);
      this.#permissionRequests.delete(requestId);
    }
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

    contents.setWindowOpenHandler(({ url }) => {
      const source = this.#requireTab(id);
      void this.createTab(windowId, {
        url,
        active: true,
        workspaceId: source.workspaceId,
        sessionId: source.sessionId,
        private: source.private
      }).catch(error => {
        console.error("Failed to open tab", error);
      });
      return { action: "deny" };
    });
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
      this.#replaceTab(id, { loading: false });
      this.#syncFromContents(id);
    });
    contents.on("did-navigate", (_event, url) => {
      if (!this.#homeTabs.has(id)) this.#replaceTab(id, { url });
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
      this.#replaceTab(id, { loading: false, url: validatedUrl || this.#requireTab(id).url });
      this.#emitUpdate(id, errorDescription);
    });
    contents.on("render-process-gone", (_event, details) => {
      this.#replaceTab(id, { loading: false });
      this.#emitUpdate(id, `A página foi encerrada (${details.reason}).`);
    });
  }

  #installPermissionHandler(session: Session): void {
    if (this.#permissionSessions.has(session)) return;
    this.#permissionSessions.add(session);
    session.setPermissionRequestHandler((contents, permission, callback) => {
      const surfaceEntry = [...this.#surfaces.entries()].find(([, surface]) =>
        surface.view.webContents.id === contents.id
      );
      const windowId = surfaceEntry ? this.#tabWindows.get(surfaceEntry[0]) : undefined;
      const host = windowId ? this.windows.get(windowId) : undefined;
      if (!windowId || !host || host.webContents.isDestroyed()) {
        callback(false);
        return;
      }
      let origin: string;
      try { origin = new URL(contents.getURL()).origin; }
      catch { callback(false); return; }
      const id = randomUUID();
      const timeout = setTimeout(() => {
        const pending = this.#permissionRequests.get(id);
        if (!pending) return;
        this.#permissionRequests.delete(id);
        pending.callback(false);
      }, 30_000);
      this.#permissionRequests.set(id, { windowId, callback, timeout });
      const request: BrowserPermissionRequest = { id, origin, permission };
      host.webContents.send("browser:permission-requested", request);
    });
  }

  #syncFromContents(id: string): void {
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
    this.#emitUpdate(id);
  }

  #emitUpdate(id: string, error?: string): void {
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
      ...(error ? { error } : {})
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
