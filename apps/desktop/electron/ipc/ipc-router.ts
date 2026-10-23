import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import type { WindowManager } from "../main/window-manager.js";
import { assertBoundedPayload, assertShellCaller } from "./ipc-policy.js";
export type IpcHandler<T = unknown, R = unknown> = (event: IpcMainInvokeEvent, payload: T) => Promise<R> | R;
export class IpcRouter {
  readonly #channels = new Set<string>();
  constructor(readonly windows: WindowManager) {}
  register<T, R>(channel: string, handler: IpcHandler<T, R>): void {
    if (this.#channels.has(channel)) throw new Error(`IPC channel already registered: ${channel}`);
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertShellCaller(event, this.windows, app.getAppPath());
      if (args.length > 1) throw new TypeError("IPC accepts one payload");
      assertBoundedPayload(args[0]);
      return handler(event, args[0] as T);
    });
    this.#channels.add(channel);
  }
  unregister(channel: string): void { ipcMain.removeHandler(channel); this.#channels.delete(channel); }
  dispose(): void { for (const channel of this.#channels) ipcMain.removeHandler(channel); this.#channels.clear(); }
}
