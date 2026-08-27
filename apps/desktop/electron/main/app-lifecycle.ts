import { app } from "electron";
import type { WindowManager } from "./window-manager.js";
export function registerApplicationLifecycle(windowManager: WindowManager, createMainWindow: () => Promise<void> | void): void {
  app.on("activate", () => { if (windowManager.list().length === 0) void createMainWindow(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
