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

  it("persists a committed history visit in the profile that owns the window", async () => {
    const browser = new FakeBrowser(); const recorded: unknown[] = [];
    const profile = { loadBrowserSession: async () => [], saveBrowserSession: async () => undefined, recordHistoryEntry: async (entry: unknown) => { recorded.push(entry); }, close: async () => undefined };
    const application = new BrowserApplicationService(browser as never, profile as never);
    const tab = await application.createTab("window-1", { url: "https://moon.test/" });
    const historyEntry = { schemaVersion: 2 as const, id: "visit-1", title: "Moon", url: "https://moon.test/", time: 10, startedAt: 10, endedAt: 20, durationMs: 10, profileId: "default", tabId: tab.id, source: "navigation" as const, navigationType: "typed" as const };
    await browser.listener?.("window-1", { tab: { ...tab, loading: false }, navigation: { canGoBack: false, canGoForward: false }, historyEntry } as never);
    expect(recorded).toEqual([historyEntry]);
    await application.shutdown();
  });
});

describe("concurrent profile persistence", () => {
  it("does not resurrect a closed-window snapshot after reopening the profile and removing its tabs", async () => {
    const browser = new FakeBrowser();
    let saved: BrowserTab[] = [];
    const profile = {
      loadBrowserSession: async () => saved,
      saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saved = [...tabs]; }
    };
    const app = new BrowserApplicationService(browser as never, profile as never);
    const tab = await app.createTab("old-window", {url: "https://saved.example/"});
    await app.closeWindow("old-window");
    expect(saved.map(item => item.id)).toEqual([tab.id]);
    await app.restoreWindow("new-window");
    await app.closeTab(tab.id);
    await app.flushWindow("new-window");
    expect(saved).toEqual([]);
    await app.shutdown();
  });
  it("keeps tabs from multiple windows instead of replacing the snapshot with the last writer", async () => {
    const browser = new FakeBrowser();
    const saves: string[][] = [];
    const profile = {
      loadBrowserSession: async () => [],
      saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saves.push(tabs.map(tab => tab.id)); }
    };
    const app = new BrowserApplicationService(browser as never, profile as never);
    await app.createTab("window-a", { url: "https://a.test/" });
    await app.createTab("window-b", { url: "https://b.test/" });
    await Promise.all([app.flushWindow("window-a"), app.flushWindow("window-b")]);
    await app.closeWindow("window-a");
    await app.closeWindow("window-b");
    expect(saves.at(-1)).toEqual(["tab-1", "tab-2"]);
    await app.shutdown();
  });

  it("waits for an in-flight save before completing shutdown", async () => {
    const browser = new FakeBrowser();
    let release!: () => void;
    let saved = 0;
    const profile = {
      loadBrowserSession: async () => [],
      saveBrowserSession: async () => { saved++; if (saved === 1) await new Promise<void>(resolve => { release = resolve; }); }
    };
    const app = new BrowserApplicationService(browser as never, profile as never);
    await app.createTab("window-a", { url: "https://test.example/" });
    const flush = app.flushWindow("window-a");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    // Wait until the first write starts, without a timer-based race.
    for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setImmediate(resolve));
    expect(release).toBeTypeOf("function");
    let finished = false;
    const shutdown = app.shutdown().then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    release();
    await flush;
    await shutdown;
    expect(saved).toBeGreaterThanOrEqual(2);
  });

  it("never persists a private window into the shared multi-window snapshot", async () => {
    const browser = new FakeBrowser();
    const saves: BrowserTab[][] = [];
    const profile = { loadBrowserSession: async () => [], saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saves.push([...tabs]); } };
    const app = new BrowserApplicationService(browser as never, profile as never);
    await app.createTab("normal", { url: "https://safe.example/" });
    await app.createTab("private", { url: "https://secret.example/", private: true });
    await app.flushWindow("private");
    expect(saves.at(-1)?.map(tab => tab.url)).toEqual(["https://safe.example/"]);
    await app.shutdown();
  });
});

it("persists an intentionally emptied normal window without resurrecting closed tabs", async () => {
  const browser = new FakeBrowser();
  const saves: BrowserTab[][] = [];
  const profile = { loadBrowserSession: async () => [], saveBrowserSession: async (tabs: readonly BrowserTab[]) => { saves.push([...tabs]); } };
  const app = new BrowserApplicationService(browser as never, profile as never);
  const tab = await app.createTab("normal", { url: "https://closed.example/" });
  await app.flushWindow("normal");
  await app.closeTab(tab.id);
  await app.flushWindow("normal");
  expect(saves.at(-1)).toEqual([]);
  await app.shutdown();
});

it("drains an in-flight history write before completing shutdown", async () => {
  const browser = new FakeBrowser();
  let release!: () => void;
  const profile = {
    loadBrowserSession: async () => [],
    saveBrowserSession: async () => undefined,
    recordHistoryEntry: async () => { await new Promise<void>(resolve => { release = resolve; }); }
  };
  const app = new BrowserApplicationService(browser as never, profile as never);
  const tab = await app.createTab("window-1", { url: "https://history.example/" });
  const pending = browser.listener?.("window-1", {
    tab, navigation: { canGoBack: false, canGoForward: false },
    historyEntry: { id: "visit", url: tab.url, title: "Visit" }
  } as never);
  for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setImmediate(resolve));
  expect(release).toBeTypeOf("function");
  let done = false;
  const shutdown = app.shutdown().then(() => { done = true; });
  await Promise.resolve();
  expect(done).toBe(false);
  release();
  await pending;
  await shutdown;
  expect(done).toBe(true);
});
