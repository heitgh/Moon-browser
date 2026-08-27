import type { ExtensionPlatform } from "@moon/platform";
import type { IpcRouter } from "./ipc-router.js";
export function registerExtensionIpc(router: IpcRouter, extensions: ExtensionPlatform): void { router.register("extensions:list", () => extensions.list()); router.register("extensions:enable", (_event, payload: { id: string }) => extensions.enable(payload.id)); router.register("extensions:disable", (_event, payload: { id: string }) => extensions.disable(payload.id)); }
