import type { IpcRouter } from "./ipc-router.js";
import type { WindowManager } from "../main/window-manager.js";
import type { ResourcePolicyController } from "../services/resource-policy-controller.js";
export function registerResourcePolicyIpc(router: IpcRouter, windows: WindowManager, policy: ResourcePolicyController): void {
  const owner = (event: Electron.IpcMainInvokeEvent): string => { const id = windows.idForWebContents(event.sender); if (!id) throw new Error("Janela indisponível."); return id; };
  const noPayload = (payload: unknown): void => { if (payload !== undefined) throw new TypeError("Esta ação não aceita parâmetros."); };
  router.register("resources:policy", (event, payload) => { noPayload(payload); return policy.state(owner(event)); });
  router.register("resources:inspect", (event, payload) => { noPayload(payload); return policy.state(owner(event), true); });
  router.register("resources:configure", (event, payload) => policy.configure(owner(event), payload));
  router.register("resources:economize", (event, payload) => { noPayload(payload); return policy.economize(owner(event)); });
  router.register("resources:cancel", (event, payload) => { noPayload(payload); policy.cancel(owner(event)); return true; });
}
