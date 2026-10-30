import { expect, it, vi } from "vitest";
import { registerResourceIpc } from "../../apps/desktop/electron/ipc/resource-ipc.js";
import type { IpcRouter } from "../../apps/desktop/electron/ipc/ipc-router.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
import type { ResourceMonitor } from "../../apps/desktop/electron/services/resource-monitor.js";
it("derives resource scope from the sender and rejects requests for another window", () => {
  const register = vi.fn(); const snapshot = vi.fn(); const idForWebContents = vi.fn(() => "owned-window");
  registerResourceIpc({register} as unknown as IpcRouter, {idForWebContents} as unknown as WindowManager, {snapshot} as unknown as ResourceMonitor);
  expect(register.mock.lastCall![0]).toBe("resources:snapshot");
  const handler = register.mock.lastCall![1]; const sender = {};
  handler({sender}, undefined); expect(idForWebContents).toHaveBeenCalledWith(sender); expect(snapshot).toHaveBeenCalledWith("owned-window");
  snapshot.mockClear(); expect(() => handler({sender}, {windowId: "another"})).toThrow(/parâmetros/); expect(snapshot).not.toHaveBeenCalled();
  idForWebContents.mockReturnValueOnce(""); expect(() => handler({sender}, undefined)).toThrow(/indisponível/);
});
