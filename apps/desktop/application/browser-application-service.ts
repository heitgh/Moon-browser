import { CommandManager } from "../../../packages/core/commands/command-manager.js";
import { MoonEventBus } from "../../../packages/core/events/event-bus.js";
import { SessionManager } from "../../../packages/core/sessions/session-manager.js";
import { MoonStateStore } from "../../../packages/core/state/state-store.js";
import { TabManager } from "../../../packages/core/tabs/tab-manager.js";
import { WorkspaceManager } from "../../../packages/core/workspaces/workspace-manager.js";
import type { BrowserTab, BrowserTabOptions } from "../../../packages/platform/interfaces/browser-platform.js";
import { ElectronBrowserPlatform } from "../adapters/electron-browser.js";
import type { BrowserTabUpdate, ElectronBrowserManager } from "../electron/browser/browser-manager.js";
import type { ProfileStorage } from "../electron/services/profile-storage.js";
import type { SitePermissionRecord } from "../../../packages/ipc/site-permission-contract.js";

export class BrowserApplicationService {
  readonly eventBus = new MoonEventBus();
  readonly stateStore = new MoonStateStore(undefined, this.eventBus);
  readonly tabs: TabManager;
  readonly workspaces = new WorkspaceManager(this.eventBus, this.stateStore);
  readonly sessions = new SessionManager(this.eventBus, this.stateStore);
  readonly commands = new CommandManager();
  readonly #browserPlatform: ElectronBrowserPlatform;
  readonly #unsubscribe: () => void;
  readonly #persistenceTimers = new Map<string, NodeJS.Timeout>();
  readonly #restoringWindows = new Set<string>();
  #shuttingDown = false;

  constructor(
    readonly browser: ElectronBrowserManager,
    profile: ProfileStorage | ((windowId: string) => Promise<ProfileStorage>)
  ) {
    this.#profileForWindow = typeof profile === "function" ? profile : async () => profile;
    this.#browserPlatform = new ElectronBrowserPlatform(browser);
    this.tabs = new TabManager(this.#browserPlatform, this.eventBus, this.stateStore);
    this.#unsubscribe = browser.onTabUpdated((windowId, update) => this.#handleTabUpdate(windowId, update));
  }

  readonly #profileForWindow: (windowId: string) => Promise<ProfileStorage>;

  get shuttingDown(): boolean { return this.#shuttingDown; }

  async restoreWindow(windowId: string): Promise<number> {
    const savedTabs = await (await this.#profileForWindow(windowId)).loadBrowserSession();
    let restored = 0;
    let activeTabId: string | undefined;
    this.#restoringWindows.add(windowId);
    try {
      for (const saved of savedTabs) {
        try {
          await this.tabs.create({ id: saved.id, windowId, url: saved.url, active: false, private: false, workspaceId: saved.workspaceId, sessionId: saved.sessionId });
          restored += 1;
          if (saved.active) activeTabId = saved.id;
        } catch (error) {
          console.error(`Failed to restore tab ${saved.id}`, error);
        }
      }
      const fallback = this.tabs.list(windowId).at(-1)?.id;
      if (activeTabId ?? fallback) await this.tabs.activate(activeTabId ?? fallback!);
    } finally {
      this.#restoringWindows.delete(windowId);
    }
    return restored;
  }

  async createTab(windowId: string, options: BrowserTabOptions = {}): Promise<BrowserTab> {
    const model = await this.tabs.create({ id: options.id, windowId, url: options.url, active: options.active, private: options.private, workspaceId: options.workspaceId, sessionId: options.sessionId });
    const tab = await this.browser.getTab(model.id);
    if (!tab) throw new Error(`Created tab is unavailable: ${model.id}`);
    return tab;
  }

  async getTabs(windowId: string): Promise<readonly BrowserTab[]> { return this.browser.getTabs(windowId); }
  async closeTab(tabId: string): Promise<void> { const model = this.tabs.require(tabId).model; await this.tabs.close(tabId); if (!model.private) this.#schedulePersistence(model.windowId); }
  async activateTab(tabId: string): Promise<void> { await this.tabs.activate(tabId); }
  showHome(tabId: string): Promise<void> { return this.browser.showHome(tabId); }
  showInternalPage(tabId: string, url: string): Promise<void> { return this.browser.showInternalPage(tabId, url); }
  navigate(tabId: string, url: string): Promise<void> { return this.browser.navigate(tabId, url); }
  goBack(tabId: string): Promise<void> { return this.browser.goBack(tabId); }
  goForward(tabId: string): Promise<void> { return this.browser.goForward(tabId); }
  reload(tabId: string, bypassCache?: boolean): Promise<void> { return this.browser.reload(tabId, bypassCache); }
  stopLoading(tabId: string): Promise<void> { return this.browser.stopLoading(tabId); }
  setBounds(windowId: string, bounds: Electron.Rectangle): void { this.browser.setBounds(windowId, bounds); }
  setContentVisible(windowId: string, visible: boolean): void { this.browser.setContentVisible(windowId, visible); }
  setSearchTemplate(windowId: string, template: string): void { this.browser.setSearchTemplate(windowId, template); }
  ownsTab(tabId: string, windowId: string): boolean { return this.browser.ownsTab(tabId, windowId); }
  respondToPermission(windowId: string, requestId: string, granted: boolean): Promise<void> { return this.browser.respondToPermission(windowId, requestId, granted); }
  listPermissions(windowId: string): readonly SitePermissionRecord[] { return this.browser.listPermissions(windowId); }
  clearPermission(windowId: string, origin: string, permission: string): Promise<void> { return this.browser.clearPermission(windowId, origin, permission); }

  async flushWindow(windowId: string): Promise<void> {
    const timer = this.#persistenceTimers.get(windowId);
    if (timer) clearTimeout(timer);
    this.#persistenceTimers.delete(windowId);
    const tabs = await this.browser.getTabs(windowId);
    if (tabs.length > 0 && tabs.every(tab => tab.private)) return;
    await (await this.#profileForWindow(windowId)).saveBrowserSession(tabs);
  }

  async closeWindow(windowId: string): Promise<void> {
    await this.flushWindow(windowId);
    await this.browser.closeTabsForWindow(windowId);
    await this.tabs.forgetWindow(windowId);
  }

  async shutdown(): Promise<void> {
    if (this.#shuttingDown) return;
    this.#shuttingDown = true;
    this.#unsubscribe();
    for (const timer of this.#persistenceTimers.values()) clearTimeout(timer);
    this.#persistenceTimers.clear();
    for (const windowId of this.browser.windowIds()) await this.flushWindow(windowId);
    await this.browser.destroy();
  }

  async #handleTabUpdate(windowId: string, update: BrowserTabUpdate): Promise<void> {
    await this.tabs.reconcile(windowId, update.tab, update.navigation);
    if (!update.tab.private && !this.#restoringWindows.has(windowId)) this.#schedulePersistence(windowId);
  }

  #schedulePersistence(windowId: string): void {
    const existing = this.#persistenceTimers.get(windowId);
    if (existing) clearTimeout(existing);
    this.#persistenceTimers.set(windowId, setTimeout(() => {
      this.#persistenceTimers.delete(windowId);
      void this.flushWindow(windowId).catch(error => console.error("Session persistence failed", error));
    }, 250));
  }
}

export interface BrowserApplicationApi {
  createTab(windowId: string, options?: BrowserTabOptions): Promise<BrowserTab>;
  getTabs(windowId: string): Promise<readonly BrowserTab[]>;
  closeTab(tabId: string): Promise<void>;
  activateTab(tabId: string): Promise<void>;
  showHome(tabId: string): Promise<void>;
  showInternalPage(tabId: string, url: string): Promise<void>;
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string, bypassCache?: boolean): Promise<void>;
  stopLoading(tabId: string): Promise<void>;
  setBounds(windowId: string, bounds: Electron.Rectangle): void;
  setContentVisible(windowId: string, visible: boolean): void;
  setSearchTemplate(windowId: string, template: string): void;
  ownsTab(tabId: string, windowId: string): boolean;
  respondToPermission(windowId: string, requestId: string, granted: boolean): Promise<void>;
  listPermissions(windowId: string): readonly SitePermissionRecord[];
  clearPermission(windowId: string, origin: string, permission: string): Promise<void>;
  closeWindow(windowId: string): Promise<void>;
}
