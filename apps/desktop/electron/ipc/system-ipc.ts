import { shell } from "electron";
import type { IpcRouter } from "./ipc-router.js";
export function registerSystemIpc(router: IpcRouter): void { router.register("system:show-item", async (_event, payload: { path: string }) => { shell.showItemInFolder(payload.path); return null; }); }
