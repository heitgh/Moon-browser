import type { BrowserPlatform, BrowserTab } from "@moon/platform";
import { BrowserError } from "../errors/browser-error.js";
import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { CreateTabInput, TabModel } from "../models/tab-model.js";
import { MoonStateStore, moonStateStore } from "../state/state-store.js";
import { Tab, type TabUpdate } from "./tab.js";

export class TabManager {
  readonly #tabs = new Map<string, Tab>();

  constructor(
    readonly browser: BrowserPlatform,
    readonly eventBus: MoonEventBus = moonEventBus,
    readonly stateStore: MoonStateStore = moonStateStore
  ) {}

  async create(input: CreateTabInput): Promise<Readonly<TabModel>> {
    const platformTab = await this.browser.createTab(
      input.windowId,
      {
        id: input.id,
        url: input.url,
        active: input.active,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        private: input.private
      }
    );
    const timestamp = Date.now();
    const model: TabModel = {
      id: platformTab.id,
      windowId: input.windowId,
      url: platformTab.url,
      title: platformTab.title,
      position: this.list(input.windowId).length,
      active: platformTab.active,
      pinned: input.pinned ?? false,
      muted: false,
      audible: false,
      discarded: false,
      private: platformTab.private,
      loadingState: platformTab.loading ? "loading" : "idle",
      canGoBack: false,
      canGoForward: false,
      workspaceId: platformTab.workspaceId,
      sessionId: platformTab.sessionId,
      groupId: input.groupId,
      openerTabId: input.openerTabId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp
    };
    const tab = new Tab(model);

    this.#tabs.set(tab.id, tab);
    await this.#persist();
    await this.eventBus.publish("tab:created", { tab: model }, {
      context: { windowId: input.windowId, tabId: model.id },
      source: { type: "core", id: "tab-manager" }
    });

    return model;
  }

  get(tabId: string): Readonly<TabModel> | undefined {
    return this.#tabs.get(tabId)?.model;
  }

  require(tabId: string): Tab {
    const tab = this.#tabs.get(tabId);

    if (!tab) {
      throw new BrowserError("TAB_NOT_FOUND", `Tab not found: ${tabId}`, {
        tabId,
        recoverable: true
      });
    }

    return tab;
  }

  list(windowId?: string): readonly Readonly<TabModel>[] {
    return [...this.#tabs.values()]
      .map(tab => tab.model)
      .filter(tab => !windowId || tab.windowId === windowId)
      .sort((left, right) => left.position - right.position);
  }

  async update(
    tabId: string,
    update: TabUpdate
  ): Promise<Readonly<TabModel>> {
    const tab = this.require(tabId);
    const previousTab = tab.model;
    const model = tab.update(update);

    await this.#persist();
    await this.eventBus.publish("tab:updated", {
      tab: model,
      previousTab
    }, {
      context: { windowId: model.windowId, tabId },
      source: { type: "core", id: "tab-manager" }
    });

    return model;
  }

  async activate(tabId: string): Promise<Readonly<TabModel>> {
    const tab = this.require(tabId);
    const previousTab = this.list(tab.model.windowId).find(item => item.active);

    await this.browser.activateTab(tabId);

    for (const candidate of this.#tabs.values()) {
      if (candidate.model.windowId === tab.model.windowId) {
        candidate.id === tabId
          ? candidate.activate()
          : candidate.deactivate();
      }
    }

    await this.#persist();
    await this.eventBus.publish("tab:activated", {
      tab: tab.model,
      previousTabId: previousTab?.id
    }, {
      context: { windowId: tab.model.windowId, tabId },
      source: { type: "core", id: "tab-manager" }
    });

    return tab.model;
  }

  async close(
    tabId: string,
    reason: "user" | "window" | "session" | "system" = "user"
  ): Promise<void> {
    const tab = this.require(tabId);
    const model = tab.model;

    await this.browser.closeTab(tabId);
    this.#tabs.delete(tabId);
    await this.#persist();
    await this.eventBus.publish("tab:closed", { tab: model, reason }, {
      context: { windowId: model.windowId, tabId },
      source: { type: "core", id: "tab-manager" }
    });
  }

  async forgetWindow(windowId: string, reason: "window" | "session" | "system" = "window"): Promise<void> {
    const removed = this.list(windowId);
    if (!removed.length) return;
    for (const tab of removed) this.#tabs.delete(tab.id);
    await this.#persist();
    for (const tab of removed) {
      await this.eventBus.publish("tab:closed", { tab, reason }, {
        context: { windowId, tabId: tab.id },
        source: { type: "core", id: "tab-manager" }
      });
    }
  }

  async reconcile(
    windowId: string,
    platformTab: BrowserTab,
    navigation: { readonly canGoBack: boolean; readonly canGoForward: boolean }
  ): Promise<Readonly<TabModel>> {
    const existing = this.#tabs.get(platformTab.id);
    if (existing) {
      const current = existing.model;
      const loadingState = platformTab.loading ? "loading" : "idle";
      if (
        current.url === platformTab.url && current.title === platformTab.title &&
        current.active === platformTab.active && current.loadingState === loadingState &&
        current.canGoBack === navigation.canGoBack && current.canGoForward === navigation.canGoForward &&
        current.workspaceId === platformTab.workspaceId && current.sessionId === platformTab.sessionId
      ) return current;
      return this.update(platformTab.id, {
        url: platformTab.url,
        title: platformTab.title,
        active: platformTab.active,
        private: platformTab.private,
        loadingState,
        canGoBack: navigation.canGoBack,
        canGoForward: navigation.canGoForward,
        workspaceId: platformTab.workspaceId,
        sessionId: platformTab.sessionId,
        lastAccessedAt: platformTab.active ? Date.now() : current.lastAccessedAt
      });
    }

    const now = Date.now();
    const model: TabModel = {
      id: platformTab.id,
      windowId,
      url: platformTab.url,
      title: platformTab.title,
      position: this.list(windowId).length,
      active: platformTab.active,
      pinned: false,
      muted: false,
      audible: false,
      discarded: false,
      private: platformTab.private,
      loadingState: platformTab.loading ? "loading" : "idle",
      canGoBack: navigation.canGoBack,
      canGoForward: navigation.canGoForward,
      workspaceId: platformTab.workspaceId,
      sessionId: platformTab.sessionId,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now
    };
    this.#tabs.set(model.id, new Tab(model));
    await this.#persist();
    await this.eventBus.publish("tab:restored", { tab: model }, {
      context: { windowId, tabId: model.id },
      source: { type: "application", id: "desktop-browser-application" }
    });
    return model;
  }

  async #persist(): Promise<void> {
    const tabs = Object.fromEntries(
      [...this.#tabs.values()].map(tab => [tab.id, tab.model])
    );
    const activeTabId = Object.values(tabs).find(tab => tab.active)?.id;

    await this.stateStore.setState(
      state => ({ ...state, tabs, activeTabId }),
      "user-action"
    );
  }
}
