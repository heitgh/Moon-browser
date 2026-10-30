import { describe, expect, it, vi } from "vitest";
const nativeDialog = vi.hoisted(() => vi.fn(async (_window: unknown, _options: unknown) => ({ response: 0 })));
vi.mock("electron", () => ({ dialog: { showMessageBox: nativeDialog } }));
import { registerResearchIpc } from "../../apps/desktop/electron/ipc/research-ipc.js";
import type { IpcRouter, IpcHandler } from "../../apps/desktop/electron/ipc/ipc-router.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
import type { ElectronBrowserManager } from "../../apps/desktop/electron/browser/browser-manager.js";
import type { BrowserApplicationService } from "../../apps/desktop/application/browser-application-service.js";
import type { LocalProfileManager } from "../../apps/desktop/electron/services/local-profile-manager.js";
function harness(privateMode = false) {
  const handlers = new Map<string, IpcHandler>(); const frame = {};
  const event = { sender: { mainFrame: frame }, senderFrame: frame } as Electron.IpcMainInvokeEvent;
  const read = vi.fn(async () => ({ url: "https://safe.test/", title: "Safe", text: "safe" })); const storage = vi.fn();
  const windows = { idForWebContents: () => "window", isPrivate: () => privateMode, isGuest: () => false, profileId: () => "profile", require: () => ({}) };
  const browser = { getTabs: async () => [{ id: "tab", url: "https://safe.test/", workspaceId: "research", private: false }], readResearchSource: read };
  registerResearchIpc({ register: (name: string, handler: IpcHandler) => handlers.set(name, handler) } as unknown as IpcRouter, windows as unknown as WindowManager, browser as unknown as ElectronBrowserManager, {} as BrowserApplicationService, { storage } as unknown as LocalProfileManager);
  return { handlers, event, read, storage, browser, nativeDialog };
}
describe("Research IPC", () => {
  it("rejects private reads and writes before accessing a profile or page", async () => {
    const h = harness(true);
    for (const channel of ["research:capture", "research:load-memory", "research:save-memory", "research:session-urls", "research:restore-session", "research:export"]) await expect(h.handlers.get(channel)!(h.event, {})).rejects.toThrow("privadas");
    expect(h.storage).not.toHaveBeenCalled(); expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects subframes and absent consent", async () => {
    const h = harness();
    await expect(h.handlers.get("research:capture")!({ ...h.event, senderFrame: {} } as Electron.IpcMainInvokeEvent, {})).rejects.toThrow();
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "research", tabIds: ["tab"], consent: false })).rejects.toThrow("autorize");
    expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects foreign tabs and workspaces before extraction", async () => {
    const h = harness();
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "other", tabIds: ["tab"], consent: true })).rejects.toThrow("workspace");
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "research", tabIds: ["foreign"], consent: true })).rejects.toThrow("workspace");
    expect(h.read).not.toHaveBeenCalled();
  });
});

describe("main-process Research consent", () => {
  it("refuses page extraction when the native consent dialog is cancelled", async () => {
    nativeDialog.mockResolvedValueOnce({ response: 0 });
    const h = harness();
    await expect(h.handlers.get("research:capture")!(h.event, {
      workspaceId: "research", tabIds: ["tab"], consent: true
    })).rejects.toThrow(/cancelada/i);
    expect(nativeDialog).toHaveBeenCalled();
    expect(h.read).not.toHaveBeenCalled();
  });

  it("reads only the previously selected page after explicit native approval", async () => {
    nativeDialog.mockResolvedValueOnce({ response: 1 });
    const h = harness();
    const sources = await h.handlers.get("research:capture")!(h.event, {
      workspaceId: "research", tabIds: ["tab"], consent: true
    });
    expect(sources).toHaveLength(1);
    expect(h.read).toHaveBeenCalledWith("tab", "window");
  });

  it("rejects a page that navigated while native approval was displayed", async () => {
    const h = harness();
    const baseline = h.browser.getTabs;
    let count = 0;
    h.browser.getTabs = async () => {
      count++;
      return [{ id: "tab", url: count === 1 ? "https://safe.test/" : "https://other.test/", workspaceId: "research", private: false }];
    };
    nativeDialog.mockResolvedValueOnce({ response: 1 });
    await expect(h.handlers.get("research:capture")!(h.event, {
      workspaceId: "research", tabIds: ["tab"], consent: true
    })).rejects.toThrow(/mudou/i);
    expect(h.read).not.toHaveBeenCalled();
    h.browser.getTabs = baseline;
  });
});
