import { expect, it, vi } from "vitest";
const electron = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: electron, app: { getAppPath: () => "/moon" } }));
import { IpcRouter } from "../../apps/desktop/electron/ipc/ipc-router.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
it("guards registered handlers before dispatching any command", async () => {
  const mainFrame = { url: "file:///moon/index.html", detached: false };
  const sender = { isDestroyed: () => false, mainFrame, getURL: () => mainFrame.url };
  const window = { isDestroyed: () => false, webContents: sender };
  const windows = { idForWebContents: () => "shell", get: () => window } as unknown as WindowManager;
  const command = vi.fn(() => "ok"); const router = new IpcRouter(windows);
  router.register("privileged:test", command);
  const invoke = electron.handle.mock.lastCall![1]; const event = { sender, senderFrame: mainFrame };
  await expect(invoke(event, { safe: true })).resolves.toBe("ok"); command.mockClear();
  for (const frame of [null, { ...mainFrame }, { url: "https://evil.test" }]) await expect(invoke({ ...event, senderFrame: frame }, {})).rejects.toThrow();
  await expect(invoke(event, {}, {})).rejects.toThrow();
  await expect(invoke(event, { size: Infinity })).rejects.toThrow();
  expect(command).not.toHaveBeenCalled(); router.dispose(); expect(electron.removeHandler).toHaveBeenCalledWith("privileged:test");
});
