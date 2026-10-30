import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const openPath = vi.fn(async () => "");
const showItemInFolder = vi.fn();
const showMessageBox = vi.fn(async (_options?: unknown) => ({ response: 0 }));

vi.mock("electron", () => ({
  shell: { openPath, showItemInFolder },
  dialog: { showMessageBox }
}));

class FakeDownload extends EventEmitter {
  filename = "file.zip";
  path = "/tmp/file.zip";
  receivedBytes = 0;
  totalBytes = 1_000;
  speed = 0;
  paused = false;
  resumable = true;
  cancelled = false;

  getURL(): string { return "https://example.com/file.zip"; }
  getFilename(): string { return this.filename; }
  getSavePath(): string { return this.path; }
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
    showMessageBox.mockReset();
    showMessageBox.mockResolvedValue({ response: 0 });
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

// Nexus Inc. — privacy boundaries apply to events and every operation, not just rendering.
it("isolates private downloads, discards metadata on close and ignores late native events", async () => {
  const { ElectronDownloadManager } = await import("../../apps/desktop/electron/services/download-manager.js");
  const normalEvents = vi.fn(); const privateEvents = vi.fn();
  const normal = Object.assign(new EventEmitter(), { webContents: { id: 1, isDestroyed: () => false, send: normalEvents } });
  const privateWindow = Object.assign(new EventEmitter(), { webContents: { id: 2, isDestroyed: () => false, send: privateEvents } });
  const windows = { list: () => [normal, privateWindow], profileId: () => "profile-a", isPrivate: (id: string) => id === "private", require: () => privateWindow, idForWebContents: (wc: { id: number }) => wc.id === 1 ? "normal" : "private" };
  const manager = new ElectronDownloadManager(windows as never);
  const session = new EventEmitter(); const download = new FakeDownload();
  const scope = manager.scopeForWindow("private");
  manager.attach(session as never, scope, "private");
  session.emit("will-download", {}, download);
  const id = manager.list(scope)[0]!.id;
  expect(manager.list("profile-a")).toEqual([]);
  expect(normalEvents).toHaveBeenLastCalledWith("download:updated", []);
  expect(privateEvents.mock.lastCall![1]).toHaveLength(1);
  expect(() => manager.pause(id, "profile-a")).toThrow();
  await expect(manager.open(id, "profile-a")).rejects.toThrow();
  expect(() => manager.showInFolder(id, "profile-a")).toThrow();
  manager.clearFinished("profile-a"); expect(manager.list(scope)).toHaveLength(1);
  privateWindow.emit("closed"); expect(download.cancelled).toBe(true);
  download.emit("updated", {}, "progressing"); download.emit("done", {}, "cancelled");
  expect(manager.list(scope)).toEqual([]);
  const preventDefault = vi.fn(); session.emit("will-download", { preventDefault }, new FakeDownload());
  expect(preventDefault).toHaveBeenCalled(); expect(manager.list(scope)).toEqual([]);
});

it("recognizes common executables and scripts without flagging ordinary documents", async () => {
  const { needsExecutableConfirmation } = await import("../../apps/desktop/electron/services/download-manager.js");
  for (const ext of [".EXE", ".msi", ".bat", ".ps1", ".scr", ".AppImage", ".sh", ".jar", ".lnk"]) {
    expect(needsExecutableConfirmation("download" + ext, "/tmp/download" + ext)).toBe(true);
  }
  for (const ext of [".pdf", ".jpg", ".txt", ".zip", ".md"]) {
    expect(needsExecutableConfirmation("download" + ext, "/tmp/download" + ext)).toBe(false);
  }
  expect(needsExecutableConfirmation("masked.exe", "/tmp/masked.txt")).toBe(true);
});

it("never opens an executable before explicit main-process confirmation", async () => {
  const { ElectronDownloadManager } = await import("../../apps/desktop/electron/services/download-manager.js");
  const manager = new ElectronDownloadManager({ list: () => [] } as never);
  const session = new EventEmitter();
  const download = new FakeDownload();
  download.filename = "installer.EXE"; download.path = "/tmp/installer.EXE";
  manager.attach(session as never); session.emit("will-download", {}, download);
  download.emit("done", {}, "completed");
  const id = manager.list()[0]!.id;
  await manager.open(id);
  expect(showMessageBox).toHaveBeenCalledOnce();
  expect(showMessageBox.mock.calls[0]![0]).toMatchObject({
    type: "warning", cancelId: 0, defaultId: 0, buttons: ["Cancelar", "Abrir arquivo"]
  });
  expect(openPath).not.toHaveBeenCalled();
  showMessageBox.mockResolvedValueOnce({ response: 1 });
  await manager.open(id);
  expect(openPath).toHaveBeenCalledWith("/tmp/installer.EXE");
});

it("cannot approve opening a download from another profile", async () => {
  const { ElectronDownloadManager } = await import("../../apps/desktop/electron/services/download-manager.js");
  const manager = new ElectronDownloadManager({ list: () => [] } as never);
  const session = new EventEmitter();
  const download = new FakeDownload();
  download.filename = "malicious.cmd"; download.path = "/tmp/malicious.cmd";
  manager.attach(session as never, "owner");
  session.emit("will-download", {}, download);
  download.emit("done", {}, "completed");
  await expect(manager.open(manager.list("owner")[0]!.id, "other")).rejects.toThrow();
  expect(showMessageBox).not.toHaveBeenCalled();
  expect(openPath).not.toHaveBeenCalled();
});

it("detects executable magic even with a document extension", async () => {
  const { hasExecutableSignature } = await import("../../apps/desktop/electron/services/download-manager.js");
  const root = await mkdtemp(join(tmpdir(), "moon-exe-check-"));
  try {
    const suspicious = join(root, "renamed.pdf");
    const harmless = join(root, "document.pdf");
    await writeFile(suspicious, Buffer.from([0x4d, 0x5a, 0x90, 0]));
    await writeFile(harmless, Buffer.from("%PDF"));
    expect(await hasExecutableSignature(suspicious)).toBe(true);
    expect(await hasExecutableSignature(harmless)).toBe(false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
