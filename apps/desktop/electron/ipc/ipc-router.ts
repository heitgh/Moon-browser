import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import type { WindowManager } from "../main/window-manager.js";
import { assertBoundedPayload, assertShellCaller } from "./ipc-policy.js";
export type IpcHandler<T = unknown, R = unknown> = (event: IpcMainInvokeEvent, payload: T) => Promise<R> | R;
export class IpcRouter {
  readonly #channels = new Set<string>();
  readonly #inflight = new Set<Promise<unknown>>();
  #disposed = false;
  constructor(readonly windows: WindowManager, readonly authorize: (event: IpcMainInvokeEvent, channel: string) => void = () => undefined) {}
  register<T, R>(channel: string, handler: IpcHandler<T, R>): void {
    if (this.#channels.has(channel)) throw new Error(`IPC channel already registered: ${channel}`);
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      const task = Promise.resolve().then(() => {
        if (this.#disposed) throw new Error("Moon is shutting down");
        assertShellCaller(event, this.windows, app.getAppPath());
        this.authorize(event, channel);
        if (args.length > 1) throw new TypeError("IPC accepts one payload");
        assertBoundedPayload(args[0]);
        return Promise.resolve(handler(event, args[0] as T)).then(result => { this.authorize(event, channel); return result; });
      });
      this.#inflight.add(task);
      void task.then(() => this.#inflight.delete(task), () => this.#inflight.delete(task));
      return task;
    });
    this.#channels.add(channel);
  }
  unregister(channel: string): void { ipcMain.removeHandler(channel); this.#channels.delete(channel); }
  dispose(): void { this.#disposed = true; for (const channel of this.#channels) ipcMain.removeHandler(channel); this.#channels.clear(); }
  async drain(): Promise<void> { await Promise.allSettled([...this.#inflight]); }
}
