// Nexus Inc. — recovery has its own document and never trusts the normal shell.
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

export function assertRecoveryDocument(event: Pick<IpcMainInvokeEvent, "sender" | "senderFrame">, window: BrowserWindow | undefined, appRoot: string): void {
  const expected = pathToFileURL(join(appRoot, "recovery.html")).href;
  if (!window || window.isDestroyed() || event.sender.isDestroyed()
    || event.sender !== window.webContents || !event.senderFrame
    || event.senderFrame !== event.sender.mainFrame || event.senderFrame.detached
    || event.senderFrame.url !== expected || event.sender.getURL() !== expected) {
    throw new Error("Janela de recuperação inválida.");
  }
}
