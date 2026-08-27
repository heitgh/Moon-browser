import { randomUUID } from "node:crypto";
import { shell, type DownloadItem, type Session } from "electron";
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

export class ElectronDownloadManager {
  readonly #attachedSessions = new WeakSet<Session>();
  readonly #nativeItems = new Map<string, DownloadItem>();
  readonly #items = new Map<string, ManagedDownload>();

  constructor(readonly windows: WindowManager) {}

  attach(session: Session): void {
    if (this.#attachedSessions.has(session)) return;
    this.#attachedSessions.add(session);
    session.on("will-download", (_event, item) => this.#track(item));
  }

  list(): readonly ManagedDownload[] {
    return [...this.#items.values()].sort((left, right) => right.startedAt - left.startedAt);
  }

  pause(id: string): void {
    const item = this.#requireNative(id);
    item.pause();
    this.#update(id, { state: "paused" });
  }

  resume(id: string): void {
    const item = this.#requireNative(id);
    if (!item.canResume()) throw new Error("This download cannot be resumed");
    item.resume();
    this.#update(id, { state: "in-progress" });
  }

  cancel(id: string): void {
    this.#requireNative(id).cancel();
  }

  async open(id: string): Promise<void> {
    const item = this.#require(id);
    if (item.state !== "completed") throw new Error("Download is not complete");
    const error = await shell.openPath(item.savePath);
    if (error) throw new Error(error);
  }

  showInFolder(id: string): void {
    shell.showItemInFolder(this.#require(id).savePath);
  }

  clearFinished(): void {
    for (const [id, item] of this.#items) {
      if (["completed", "cancelled", "failed"].includes(item.state)) {
        this.#items.delete(id);
        this.#nativeItems.delete(id);
      }
    }
    this.#broadcast();
  }

  #track(item: DownloadItem): void {
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
    this.#nativeItems.set(id, item);
    this.#broadcast();

    item.on("updated", (_event, state) => {
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
      this.#update(id, {
        savePath: item.getSavePath(),
        state: state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "failed",
        receivedBytes: item.getReceivedBytes(),
        totalBytes: Math.max(0, item.getTotalBytes()),
        speedBytesPerSecond: 0,
        percentage: state === "completed" ? 100 : this.#require(id).percentage,
        completedAt: Date.now()
      });
    });
  }

  #update(id: string, patch: Partial<ManagedDownload>): void {
    this.#items.set(id, { ...this.#require(id), ...patch });
    this.#broadcast();
  }

  #broadcast(): void {
    const downloads = this.list();
    for (const window of this.windows.list()) {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send("download:updated", downloads);
      }
    }
  }

  #require(id: string): ManagedDownload {
    const item = this.#items.get(id);
    if (!item) throw new Error(`Download not found: ${id}`);
    return item;
  }

  #requireNative(id: string): DownloadItem {
    const item = this.#nativeItems.get(id);
    if (!item) throw new Error(`Active download not found: ${id}`);
    return item;
  }
}
