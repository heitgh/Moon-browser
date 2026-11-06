import { describe, expect, it, vi } from "vitest";
vi.mock("electron", () => ({ dialog: {} }));
import { registerResearchIpc } from "../../apps/desktop/electron/ipc/research-ipc.js";
import type { IpcRouter, IpcHandler } from "../../apps/desktop/electron/ipc/ipc-router.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
import type { ElectronBrowserManager } from "../../apps/desktop/electron/browser/browser-manager.js";
import type { BrowserApplicationService } from "../../apps/desktop/application/browser-application-service.js";
import type { NativeConsent } from "../../apps/desktop/electron/security/native-consent.js";
import type { LocalProfileManager } from "../../apps/desktop/electron/services/local-profile-manager.js";
function harness(privateMode = false) {
  const handlers = new Map<string, IpcHandler>(); const frame = {};
  const event = { sender: { mainFrame: frame }, senderFrame: frame } as Electron.IpcMainInvokeEvent;
  const read = vi.fn(); const storage = vi.fn();
  let version = 1;
  const confirm = vi.fn(async () => false);
  const windows = { idForWebContents: () => "window", isPrivate: () => privateMode, isGuest: () => false, profileId: () => "profile", require: () => ({}) };
  const browser = { researchDocument: (id: string) => {
    if (id !== "tab") throw new Error("Aba fora da janela.");
    return { url: "https://example.com/", title: "Fixture", workspaceId: "research", contentsId: 1, version };
  }, readResearchSource: read };
  const router = {register: (name: string, handler: IpcHandler) => handlers.set(name, handler), assertActive: vi.fn()};
  registerResearchIpc(router as unknown as IpcRouter, windows as unknown as WindowManager, browser as unknown as ElectronBrowserManager, {} as BrowserApplicationService, { storage } as unknown as LocalProfileManager, {confirm} as unknown as NativeConsent);
  return { handlers, event, read, storage, confirm, navigate: () => {version++;} };

}
describe("Research IPC", () => {
  it("rejects private reads and writes before accessing a profile or page", async () => {
    const h = harness(true);
    for (const channel of ["research:capture", "research:load-memory", "research:save-memory", "research:session-urls", "research:restore-session", "research:export"]) await expect(h.handlers.get(channel)!(h.event, {})).rejects.toThrow("privadas");
    expect(h.storage).not.toHaveBeenCalled(); expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects subframes and ignores a renderer consent flag when native review cancels", async () => {
    const h = harness();
    await expect(h.handlers.get("research:capture")!({ ...h.event, senderFrame: {} } as Electron.IpcMainInvokeEvent, {})).rejects.toThrow();
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "research", tabIds: ["tab"], consent: true })).rejects.toThrow("cancelada");
    expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects a reload of the same URL during native review", async () => {
    const h = harness();
    h.confirm.mockImplementationOnce(async () => { h.navigate(); return true; });
    await expect(h.handlers.get("research:capture")!(h.event, {workspaceId: "research", tabIds: ["tab"]})).rejects.toThrow("mudou");
    expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects foreign tabs and workspaces before extraction", async () => {
    const h = harness();
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "other", tabIds: ["tab"], consent: true })).rejects.toThrow("workspace");
    await expect(h.handlers.get("research:capture")!(h.event, { workspaceId: "research", tabIds: ["foreign"], consent: true })).rejects.toThrow("janela");
    expect(h.read).not.toHaveBeenCalled();
  });
});
