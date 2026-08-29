import { describe, expect, it } from "vitest";
import { BrowserApplicationService } from "../../apps/desktop/application/browser-application-service.js";
import type { BrowserTab, BrowserTabOptions } from "../../packages/platform/interfaces/browser-platform.js";

class FakeBrowser {
  readonly tabs = new Map<string, BrowserTab>();
  readonly tabWindows = new Map<string, string>();
  listener: ((windowId: string, update: { readonly tab: BrowserTab; readonly navigation: { readonly canGoBack: boolean; readonly canGoForward: boolean } }) => void | Promise<void>) | undefined;
  #nextId = 0;

  onTabUpdated(listener: NonNullable<FakeBrowser["listener"]>): () => void { this.listener = listener; return () => { this.listener = undefined; }; }
  async createTab(windowId: string, options: BrowserTabOptions = {}): Promise<BrowserTab> {
    const id = options.id ?? `tab-${++this.#nextId}`;
    const tab = { id, url: options.url ?? "moon://newtab", title: "Nova guia", active: options.active !== false, loading: false, workspaceId: options.workspaceId, sessionId: options.sessionId, private: options.private ?? false };
    this.tabs.set(id, tab);
    this.tabWindows.set(id, windowId);
    await this.listener?.(windowId, { tab, navigation: { canGoBack: false, canGoForward: false } });
    return tab;
  }
  async getTab(id: string): Promise<BrowserTab | null> { return this.tabs.get(id) ?? null; }
  async getTabs(windowId?: string): Promise<readonly BrowserTab[]> { return [...this.tabs].filter(([id]) => !windowId || this.tabWindows.get(id) === windowId).map(([, tab]) => tab); }
  windowIds(): readonly string[] { return [...new Set(this.tabWindows.values())]; }
  async activateTab(id: string): Promise<void> { for (const [tabId, tab] of this.tabs) this.tabs.set(tabId, { ...tab, active: tabId === id }); }
  async closeTab(id: string): Promise<void> { this.tabs.delete(id); this.tabWindows.delete(id); }
  async closeTabsForWindow(windowId: string): Promise<void> { for (const [id] of this.tabs) if (this.tabWindows.get(id) === windowId) { this.tabs.delete(id); this.tabWindows.delete(id); } }
  async showHome(id: string): Promise<void> { this.tabs.set(id, { ...this.tabs.get(id)!, url: "moon://newtab" }); }
  async navigate(id: string, url: string): Promise<void> { this.tabs.set(id, { ...this.tabs.get(id)!, url }); }
  async goBack(): Promise<void> {}
  async goForward(): Promise<void> {}
  async reload(): Promise<void> {}
  async stopLoading(): Promise<void> {}
  setBounds(): void {}
  setContentVisible(): void {}
  ownsTab(id: string): boolean { return this.tabs.has(id); }
  respondToPermission(): void {}
  async createWindow(): Promise<string> { return "window-1"; }
  async closeWindow(): Promise<void> {}
  async focusWindow(): Promise<void> {}
  async executeScript(): Promise<unknown> { return undefined; }
  async capturePage(): Promise<Uint8Array> { return new Uint8Array(); }
  async destroy(): Promise<void> { this.tabs.clear(); }
}

describe("BrowserApplicationService", () => {
  it("restores saved tabs through Core and excludes storage details from UI", async () => {
    const browser = new FakeBrowser();
    const saved = [
      { id: "restored-1", url: "moon://newtab", active: false, workspaceId: "research" },
      { id: "restored-2", url: "https://moon.test/", active: true, workspaceId: "research" }
    ];
    const persisted: BrowserTab[][] = [];
    const profile = {
      loadBrowserSession: async () => saved,
      saveBrowserSession: async (tabs: readonly BrowserTab[]) => { persisted.push([...tabs]); },
      close: async () => undefined
    };
    const application = new BrowserApplicationService(browser as never, profile as never);
    expect(await application.restoreWindow("window-1")).toBe(2);
    expect(application.tabs.list("window-1").map(tab => tab.id)).toEqual(["restored-1", "restored-2"]);
    expect(application.stateStore.getState().activeTabId).toBe("restored-2");
    await application.flushWindow("window-1");
    expect(persisted.at(-1)?.map(tab => tab.id)).toEqual(["restored-1", "restored-2"]);
    await application.shutdown();
  });

  it("never lets a private-only window overwrite the restorable session", async () => {
    const browser = new FakeBrowser();
    const persisted: BrowserTab[][] = [];
    const profile = { loadBrowserSession: async () => [], saveBrowserSession: async (tabs: readonly BrowserTab[]) => { persisted.push([...tabs]); }, close: async () => undefined };
    const application = new BrowserApplicationService(browser as never, profile as never);
    const tab = await application.createTab("private-window", { private: true, sessionId: "private-window" });
    expect(tab.private).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    await application.flushWindow("private-window");
    expect(persisted).toEqual([]);
    await application.shutdown();
  });

  it("routes sessions to the owning profile and forgets closed-window Core state", async () => {
    const browser = new FakeBrowser(); const saves = new Map<string, BrowserTab[][]>();
    const storages = new Map([
      ["window-a", { loadBrowserSession: async () => [{ id: "a-tab", url: "moon://newtab", active: true }], saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saves.set("window-a", [[...tabs]]); } }],
      ["window-b", { loadBrowserSession: async () => [{ id: "b-tab", url: "https://isolated.test/", active: true }], saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saves.set("window-b", [[...tabs]]); } }]
    ]);
    const application = new BrowserApplicationService(browser as never, async windowId => storages.get(windowId) as never);
    await application.restoreWindow("window-a"); await application.restoreWindow("window-b");
    expect(application.tabs.list("window-a").map(tab => tab.id)).toEqual(["a-tab"]); expect(application.tabs.list("window-b").map(tab => tab.id)).toEqual(["b-tab"]);
    await application.closeWindow("window-a");
    expect(application.tabs.list("window-a")).toEqual([]); expect(application.tabs.list("window-b").map(tab => tab.id)).toEqual(["b-tab"]); expect(saves.get("window-a")?.[0]?.map(tab => tab.id)).toEqual(["a-tab"]);
    await application.shutdown();
  });
});
