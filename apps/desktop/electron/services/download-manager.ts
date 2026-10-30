import { randomUUID } from "node:crypto";
import { dialog, shell, type DownloadItem, type Session } from "electron";
import { extname } from "node:path";
import type { WindowManager } from "../main/window-manager.js";

export type ManagedDownloadState =
  | "in-progress"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface ManagedDownload {
  readonly id: string;
  readonly url: string;
  readonly filename: string;
  readonly savePath: string;
  readonly state: ManagedDownloadState;
  readonly receivedBytes: number;
  readonly totalBytes: number;
  readonly speedBytesPerSecond: number;
  readonly percentage: number | null;
  readonly startedAt: number;
  readonly completedAt?: number;
}

// Executables/scripts can be invoked by the OS when opened through shell.openPath.
const EXECUTABLE_EXTENSIONS = new Set([
  ".exe", ".msi", ".msp", ".msix", ".appx", ".bat", ".cmd", ".com", ".scr",
  ".ps1", ".psm1", ".vbs", ".vbe", ".wsf", ".wsh", ".hta", ".lnk",
  ".app", ".dmg", ".pkg", ".command", ".sh", ".bash", ".zsh", ".run",
  ".appimage", ".deb", ".rpm", ".jar", ".desktop", ".py"
]);

export function needsExecutableConfirmation(filename: string, savePath: string): boolean {
  return [filename, savePath].some(value => EXECUTABLE_EXTENSIONS.has(extname(value).toLowerCase()));
}

export class ElectronDownloadManager {
  readonly #attachedSessions = new WeakSet<Session>();
  readonly #sessionProfiles = new WeakMap<Session, string>();
  readonly #nativeItems = new Map<string, DownloadItem>();
  readonly #items = new Map<string, ManagedDownload>();
  readonly #itemProfiles = new Map<string, string>();

  constructor(readonly windows: WindowManager) {}

  // Nexus Inc. — private download metadata belongs to its window, never the profile.
  scopeForWindow(windowId: string): string {
    const profileId = this.windows.profileId(windowId);
    return this.windows.isPrivate(windowId) ? JSON.stringify(["private", profileId, windowId]) : profileId;
  }

  attach(session: Session, profileId = "default", privateWindowId?: string): void {
    if (this.#attachedSessions.has(session)) return;
    this.#attachedSessions.add(session);
    let released = false;
    if (privateWindowId) {
      if (!this.windows.isPrivate(privateWindowId) || this.scopeForWindow(privateWindowId) !== profileId) throw new Error("Invalid private download scope");
      this.windows.require(privateWindowId).once("closed", () => { released = true; this.forgetScope(profileId); });
    }
    this.#sessionProfiles.set(session, profileId);
    session.on("will-download", (event, item) => {
      if (released) { event.preventDefault(); return; }
      this.#track(item, this.#sessionProfiles.get(session) ?? profileId);
    });
  }

  forgetScope(scope: string): void {
    for (const [id, itemScope] of this.#itemProfiles) {
      if (itemScope !== scope) continue;
      const native = this.#nativeItems.get(id);
      const active = ["in-progress", "paused"].includes(this.#items.get(id)?.state ?? "");
      this.#items.delete(id); this.#nativeItems.delete(id); this.#itemProfiles.delete(id);
      if (active) native?.cancel();
    }
  }

  list(profileId?: string): readonly ManagedDownload[] {
    return [...this.#items.entries()].filter(([id]) => profileId === undefined || this.#itemProfiles.get(id) === profileId).map(([, item]) => item).sort((left, right) => right.startedAt - left.startedAt);
  }

  pause(id: string, profileId?: string): void {
    const item = this.#requireNative(id, profileId);
    item.pause();
    this.#update(id, { state: "paused" });
  }

  resume(id: string, profileId?: string): void {
    const item = this.#requireNative(id, profileId);
    if (!item.canResume()) throw new Error("This download cannot be resumed");
    item.resume();
    this.#update(id, { state: "in-progress" });
  }

  cancel(id: string, profileId?: string): void {
    this.#requireNative(id, profileId).cancel();
  }

  async open(id: string, profileId?: string): Promise<void> {
    const item = this.#require(id, profileId);
    if (item.state !== "completed") throw new Error("Download is not complete");
    if (needsExecutableConfirmation(item.filename, item.savePath)) {
      // Authorization stays in Electron main and is required on every attempt.
      const { response } = await dialog.showMessageBox({
        type: "warning",
        title: "Confirmar abertura de executável",
        message: "Este arquivo pode executar programas ou comandos no seu computador.",
        detail: `Arquivo: ${item.filename}\nDestino: ${item.savePath}\nOrigem: ${item.url}\n\nAbra somente se confiar na origem.`,
        buttons: ["Cancelar", "Abrir arquivo"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (response !== 1) return;
      // The download can be cleared while the confirmation dialog is open.
      if (this.#require(id, profileId).state !== "completed") throw new Error("Download is no longer complete");
    }
    const error = await shell.openPath(item.savePath);
    if (error) throw new Error(error);
  }

  showInFolder(id: string, profileId?: string): void {
    shell.showItemInFolder(this.#require(id, profileId).savePath);
  }

  clearFinished(profileId?: string): void {
    for (const [id, item] of this.#items) {
      if (profileId !== undefined && this.#itemProfiles.get(id) !== profileId) continue;
      if (["completed", "cancelled", "failed"].includes(item.state)) {
        this.#items.delete(id);
        this.#nativeItems.delete(id);
        this.#itemProfiles.delete(id);
      }
    }
    this.#broadcast();
  }

  #track(item: DownloadItem, profileId: string): void {
    const id = randomUUID();
    const totalBytes = Math.max(0, item.getTotalBytes());
    const download: ManagedDownload = {
      id,
      url: item.getURL(),
      filename: item.getFilename(),
      savePath: item.getSavePath(),
      state: "in-progress",
      receivedBytes: item.getReceivedBytes(),
      totalBytes,
      speedBytesPerSecond: 0,
      percentage: totalBytes > 0 ? 0 : null,
      startedAt: Date.now()
    };
    this.#items.set(id, download);
    this.#itemProfiles.set(id, profileId);
    this.#nativeItems.set(id, item);
    this.#broadcast();

    item.on("updated", (_event, state) => {
      if (!this.#items.has(id)) return;
      const receivedBytes = item.getReceivedBytes();
      const currentTotal = Math.max(0, item.getTotalBytes());
      this.#update(id, {
        savePath: item.getSavePath(),
        state: item.isPaused() || (state === "interrupted" && item.canResume())
          ? "paused"
          : state === "interrupted"
            ? "failed"
            : "in-progress",
        receivedBytes,
        totalBytes: currentTotal,
        speedBytesPerSecond: item.getCurrentBytesPerSecond(),
        percentage: currentTotal > 0 ? Math.min(100, (receivedBytes / currentTotal) * 100) : null
      });
    });

    item.once("done", (_event, state) => {
      if (!this.#items.has(id)) return;
      this.#update(id, {
        savePath: item.getSavePath(),
        state: state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "failed",
        receivedBytes: item.getReceivedBytes(),
        totalBytes: Math.max(0, item.getTotalBytes()),
        speedBytesPerSecond: 0,
        percentage: state === "completed" ? 100 : this.#require(id, profileId).percentage,
        completedAt: Date.now()
      });
    });
  }

  #update(id: string, patch: Partial<ManagedDownload>): void {
    this.#items.set(id, { ...this.#require(id), ...patch });
    this.#broadcast();
  }

  #broadcast(): void {
    for (const window of this.windows.list()) {
      if (!window.webContents.isDestroyed()) {
        const windowId = this.windows.idForWebContents(window.webContents);
        if (windowId) window.webContents.send("download:updated", this.list(this.scopeForWindow(windowId)));
      }
    }
  }

  #require(id: string, profileId?: string): ManagedDownload {
    const item = this.#items.get(id);
    if (!item || (profileId !== undefined && this.#itemProfiles.get(id) !== profileId)) throw new Error(`Download not found: ${id}`);
    return item;
  }

  #requireNative(id: string, profileId?: string): DownloadItem {
    const item = this.#nativeItems.get(id);
    if (!item || (profileId !== undefined && this.#itemProfiles.get(id) !== profileId)) throw new Error(`Active download not found: ${id}`);
    return item;
  }
}
