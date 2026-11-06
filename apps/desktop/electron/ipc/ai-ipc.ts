import { parseAiRequest } from "../../../../packages/ipc/ai-contract.js";
import type { AiService } from "../ai/ai-service.js";
import type { WindowManager } from "../main/window-manager.js";
import type { IpcRouter } from "./ipc-router.js";

export function registerAiIpc(router: IpcRouter, windows: WindowManager, ai: AiService): void {
  const owner = (event: Electron.IpcMainInvokeEvent): string => {
    const id = windows.idForWebContents(event.sender);
    if (!id) throw new Error("Janela indisponível.");
    return id;
  };
  const noPayload = (value: unknown): void => {
    if (value !== undefined) throw new TypeError("A ação não aceita parâmetros.");
  };
  router.register("ai:state", (event, value) => {noPayload(value); return ai.state(owner(event));});
  router.register("ai:choose-model", (event, value) => {
    noPayload(value);
    return ai.chooseModel(owner(event), () => router.assertActive(event, "ai:choose-model"));
  });
  router.register("ai:disable-model", (event, value) => {
    noPayload(value);
    return ai.disableModel(owner(event), () => router.assertActive(event, "ai:disable-model"));
  });
  router.register("ai:run", (event, value) => ai.run(owner(event), parseAiRequest(value),
    () => router.assertActive(event, "ai:run"), chunk => event.sender.send("ai:chunk", chunk)));
  router.register("ai:cancel", (event, value) => {noPayload(value); ai.cancel(owner(event));});
}
