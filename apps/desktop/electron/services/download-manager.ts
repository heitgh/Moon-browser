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
  readonly #sessionProfiles = new WeakMap<Session, string>();
  readonly #nativeItems = new Map<string, DownloadItem>();
  readonly #items = new Map<string, ManagedDownload>();
  readonly #itemProfiles = new Map<string, string>();

  constructor(readonly windows: WindowManager) {}

  attach(session: Session, profileId = "default"): void {
    if (this.#attachedSessions.has(session)) return;
    this.#attachedSessions.add(session);
    this.#sessionProfiles.set(session, profileId);
    session.on("will-download", (_event, item) => this.#track(item, this.#sessionProfiles.get(session) ?? profileId));
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
        if (windowId) window.webContents.send("download:updated", this.list(this.windows.profileId(windowId)));
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
