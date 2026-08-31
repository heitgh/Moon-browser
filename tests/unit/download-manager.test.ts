import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openPath = vi.fn(async () => "");
const showItemInFolder = vi.fn();

vi.mock("electron", () => ({
  shell: { openPath, showItemInFolder }
}));

class FakeDownload extends EventEmitter {
  receivedBytes = 0;
  totalBytes = 1_000;
  speed = 0;
  paused = false;
  resumable = true;
  cancelled = false;

  getURL(): string { return "https://example.com/file.zip"; }
  getFilename(): string { return "file.zip"; }
  getSavePath(): string { return "/tmp/file.zip"; }
  getTotalBytes(): number { return this.totalBytes; }
  getReceivedBytes(): number { return this.receivedBytes; }
  getCurrentBytesPerSecond(): number { return this.speed; }
  isPaused(): boolean { return this.paused; }
  canResume(): boolean { return this.resumable; }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  cancel(): void { this.cancelled = true; }
}

describe("ElectronDownloadManager", () => {
  beforeEach(() => {
    openPath.mockClear();
    showItemInFolder.mockClear();
  });

  it("tracks real progress and terminal state from Electron", async () => {
    const { ElectronDownloadManager } = await import(
      "../../apps/desktop/electron/services/download-manager.js"
    );
    const manager = new ElectronDownloadManager({ list: () => [] } as never);
    const session = new EventEmitter();
    const download = new FakeDownload();
    manager.attach(session as never);

    session.emit("will-download", {}, download);
    const id = manager.list()[0]!.id;
    expect(manager.list()[0]).toMatchObject({
      filename: "file.zip",
      state: "in-progress",
      percentage: 0
    });

    download.receivedBytes = 500;
    download.speed = 125;
    download.emit("updated", {}, "progressing");
    expect(manager.list()[0]).toMatchObject({
      receivedBytes: 500,
      speedBytesPerSecond: 125,
      percentage: 50
    });

    manager.pause(id);
    expect(manager.list()[0]!.state).toBe("paused");
    manager.resume(id);
    expect(manager.list()[0]!.state).toBe("in-progress");

    download.receivedBytes = 1_000;
    download.emit("done", {}, "completed");
    expect(manager.list()[0]).toMatchObject({ state: "completed", percentage: 100 });
    await manager.open(id);
    manager.showInFolder(id);
    expect(openPath).toHaveBeenCalledWith("/tmp/file.zip");
    expect(showItemInFolder).toHaveBeenCalledWith("/tmp/file.zip");
  });

  it("cancels and clears finished downloads", async () => {
    const { ElectronDownloadManager } = await import(
      "../../apps/desktop/electron/services/download-manager.js"
    );
    const manager = new ElectronDownloadManager({ list: () => [] } as never);
    const session = new EventEmitter();
    const download = new FakeDownload();
    manager.attach(session as never);
    session.emit("will-download", {}, download);
    const id = manager.list()[0]!.id;

    manager.cancel(id);
    expect(download.cancelled).toBe(true);
    download.emit("done", {}, "cancelled");
    manager.clearFinished();
    expect(manager.list()).toEqual([]);
  });

  it("never exposes or controls a download from another profile", async () => {
    const { ElectronDownloadManager } = await import("../../apps/desktop/electron/services/download-manager.js");
    const manager = new ElectronDownloadManager({ list: () => [] } as never);
    const sessionA = new EventEmitter(); const sessionB = new EventEmitter(); const first = new FakeDownload(); const second = new FakeDownload();
    manager.attach(sessionA as never, "profile-a"); manager.attach(sessionB as never, "profile-b");
    sessionA.emit("will-download", {}, first); sessionB.emit("will-download", {}, second);
    expect(manager.list("profile-a")).toHaveLength(1); expect(manager.list("profile-b")).toHaveLength(1);
    const firstId = manager.list("profile-a")[0]!.id;
    expect(() => manager.pause(firstId, "profile-b")).toThrow(/not found/i);
    manager.pause(firstId, "profile-a"); expect(first.paused).toBe(true); expect(second.paused).toBe(false);
  });
});
