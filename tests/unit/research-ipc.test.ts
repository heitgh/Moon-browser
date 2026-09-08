import { describe, expect, it, vi } from "vitest";
vi.mock("electron", () => ({ dialog: {} }));
import { registerResearchIpc } from "../../apps/desktop/electron/ipc/research-ipc.js";
import type { IpcRouter, IpcHandler } from "../../apps/desktop/electron/ipc/ipc-router.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
import type { ElectronBrowserManager } from "../../apps/desktop/electron/browser/browser-manager.js";
import type { BrowserApplicationService } from "../../apps/desktop/application/browser-application-service.js";
import type { LocalProfileManager } from "../../apps/desktop/electron/services/local-profile-manager.js";
function harness(privateMode = false) {
  const handlers = new Map<string, IpcHandler>(); const frame = {};
  const event = { sender: { mainFrame: frame }, senderFrame: frame } as Electron.IpcMainInvokeEvent;
  const read = vi.fn(); const storage = vi.fn();
  const windows = { idForWebContents: () => "window", isPrivate: () => privateMode, isGuest: () => false, profileId: () => "profile" };
  const browser = { getTabs: async () => [{ id: "tab", workspaceId: "research", private: false }], readResearchSource: read };
  registerResearchIpc({ register: (name: string, handler: IpcHandler) => handlers.set(name, handler) } as unknown as IpcRouter, windows as unknown as WindowManager, browser as unknown as ElectronBrowserManager, {} as BrowserApplicationService, { storage } as unknown as LocalProfileManager);
  return { handlers, event, read, storage };
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
