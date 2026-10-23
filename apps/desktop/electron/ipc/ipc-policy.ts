// Nexus Inc. — all privileged commands originate in the registered shell main frame.
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import type { WindowManager } from "../main/window-manager.js";

type Caller = Pick<IpcMainInvokeEvent | IpcMainEvent, "sender" | "senderFrame">;
export function assertShellCaller(event: Caller, windows: WindowManager, appRoot: string): void {
  const sender = event.sender;
  if (sender.isDestroyed()) throw new Error("IPC sender is destroyed");
  const id = windows.idForWebContents(sender);
  const window = id ? windows.get(id) : undefined;
  if (!window || window.isDestroyed() || window.webContents !== sender) throw new Error("IPC window is not registered");
  const frame = event.senderFrame;
  if (!frame || frame !== sender.mainFrame || frame.detached) throw new Error("IPC requires the shell main frame");
  const expected = pathToFileURL(join(appRoot, "index.html")).href;
  // Exact document identity: no sibling files, remote origins, query strings or inherited origins.
  if (frame.url !== expected || sender.getURL() !== expected) throw new Error("IPC origin is not the Moon shell");
}

export function assertBoundedPayload(payload: unknown): void {
  let nodes = 0;
  let bytes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (depth > 32 || ++nodes > 100_000) throw new TypeError("IPC payload is too complex");
    if (value === undefined || value === null || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value === "string") { bytes += value.length; if (bytes > 8_000_000) throw new TypeError("IPC payload is too large"); return; }
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Invalid IPC payload type");
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new TypeError("Invalid IPC payload key");
      visit(key, depth + 1); visit(item, depth + 1);
    }
  };
  visit(payload, 0);
}
