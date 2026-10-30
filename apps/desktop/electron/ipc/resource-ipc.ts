// Nexus Inc. — the router validates the shell and unlocked profile before sampling.
import type { IpcRouter } from "./ipc-router.js";
import type { WindowManager } from "../main/window-manager.js";
import type { ResourceMonitor } from "../services/resource-monitor.js";
export function registerResourceIpc(router: IpcRouter, windows: WindowManager, monitor: ResourceMonitor): void {
  router.register("resources:snapshot", (event, payload) => {
    if (payload !== undefined) throw new TypeError("A consulta de recursos não aceita parâmetros.");
    const id = windows.idForWebContents(event.sender);
    if (!id) throw new Error("Janela indisponível.");
    return monitor.snapshot(id);
  });
}
