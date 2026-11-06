import { expect, it, vi } from "vitest";
import { TabLifecycleService } from "../../apps/desktop/electron/services/tab-lifecycle-service.js";
import { DEFAULT_RESOURCE_SETTINGS } from "../../packages/ipc/resource-policy-contract.js";
import type { BrowserTabUpdate as TabUpdate } from "../../apps/desktop/electron/browser/browser-manager.js";
function fixture() {
  let now = 0; let updated!: (window: string, update: TabUpdate) => void;
  const tab = {id: "tab", title: "Static", url: "https://example.com/read", active: false, loading: false, private: false};
  const activity = {documentId: "1-2-3-4", url: tab.url, eligible: true, reasons: [], scrollX: 0, scrollY: 0};
  const browser = {onTabUpdated: (listener: typeof updated) => {updated = listener; return () => undefined;}, onTabClosed: () => () => undefined, getTabs: vi.fn(async () => [tab]), inspectSuspension: vi.fn(async () => activity), ownsTab: vi.fn(() => true), suspendTab: vi.fn(async () => undefined)};
  const application = {flushWindow: vi.fn(async () => undefined)};
  const [b, a] = [browser, application] as unknown as [ConstructorParameters<typeof TabLifecycleService>[0], ConstructorParameters<typeof TabLifecycleService>[1]];
  const lifecycle = new TabLifecycleService(b, a, undefined, () => now);
  return {lifecycle, browser, application, activity, tick: (value: number) => {now = value;}, updated, tab};
}
const settings = {...DEFAULT_RESOURCE_SETTINGS, automatic: true, idleMinutes: 1, reloadSafeOrigins: ["https://example.com"]};
it("measures inactivity from deactivation and never inspects active or not-yet-idle content", async () => {
  const f = fixture(); const guard = vi.fn();
  f.updated("window", {tab: {...f.tab, active: true}, navigation: {canGoBack: false, canGoForward: false}});
  f.tick(60_000); f.updated("window", {tab: f.tab, navigation: {canGoBack: false, canGoForward: false}});
  f.tick(61_000); expect((await f.lifecycle.inspect("window", settings, false, guard))[0]!.eligible).toBe(false);
  expect(f.browser.inspectSuspension).not.toHaveBeenCalled();
  f.tick(121_000); expect((await f.lifecycle.inspect("window", settings, false, guard))[0]!.eligible).toBe(true); f.lifecycle.dispose();
});
it("checks ownership after inspection and reuses application persistence after physical suspension", async () => {
  const f = fixture(); const guard = vi.fn(); const [candidate] = await f.lifecycle.inspect("window", settings, true, guard);
  await f.lifecycle.suspend("window", candidate!, guard); expect(f.browser.suspendTab).toHaveBeenCalledWith("tab", f.activity, guard); expect(f.application.flushWindow).toHaveBeenCalledWith("window");
  f.browser.ownsTab.mockReturnValue(false); await expect(f.lifecycle.inspect("window", settings, true, guard)).rejects.toThrow("janela"); f.lifecycle.dispose();
});
