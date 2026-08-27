import { describe, expect, it } from "vitest";
import { BrowserApplicationService } from "../../apps/desktop/application/browser-application-service.js";
import type { BrowserTab, BrowserTabOptions } from "../../packages/platform/interfaces/browser-platform.js";

class FakeBrowser {
  readonly tabs = new Map<string, BrowserTab>();
  listener: ((windowId: string, update: { readonly tab: BrowserTab; readonly navigation: { readonly canGoBack: boolean; readonly canGoForward: boolean } }) => void | Promise<void>) | undefined;
  #nextId = 0;

  onTabUpdated(listener: NonNullable<FakeBrowser["listener"]>): () => void { this.listener = listener; return () => { this.listener = undefined; }; }
  async createTab(windowId: string, options: BrowserTabOptions = {}): Promise<BrowserTab> {
    const id = options.id ?? `tab-${++this.#nextId}`;
    const tab = { id, url: options.url ?? "moon://newtab", title: "Nova guia", active: options.active !== false, loading: false, workspaceId: options.workspaceId, sessionId: options.sessionId, private: options.private ?? false };
    this.tabs.set(id, tab);
    await this.listener?.(windowId, { tab, navigation: { canGoBack: false, canGoForward: false } });
    return tab;
  }
  async getTab(id: string): Promise<BrowserTab | null> { return this.tabs.get(id) ?? null; }
  async getTabs(): Promise<readonly BrowserTab[]> { return [...this.tabs.values()]; }
  windowIds(): readonly string[] { return this.tabs.size ? ["window-1"] : []; }
  async activateTab(id: string): Promise<void> { for (const [tabId, tab] of this.tabs) this.tabs.set(tabId, { ...tab, active: tabId === id }); }
  async closeTab(id: string): Promise<void> { this.tabs.delete(id); }
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
});
