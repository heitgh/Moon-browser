import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
vi.mock("electron-updater", () => ({ default: {} }));
import { NativeUpdater, updateFeed } from "../../apps/desktop/electron/services/native-updater.js";
const update = { version: "v0.6.0-alpha.6", url: "https://github.com/heitgh/Moon-browser/releases/tag/v0.6.0-alpha.6", notes: "" };
const runtime = { packaged: true, platform: "win32", portable: false, appImage: false, moon: "0.6.0-alpha.5", chromium: "test", electron: "test" };
function harness(version = "0.6.0-alpha.6") {
  const native = Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn(async () => ({ updateInfo: { version } })),
    downloadUpdate: vi.fn(async () => { native.emit("download-progress", { percent: 42 }); return ["/private/installer.exe"]; }),
    quitAndInstall: vi.fn(), autoDownload: true, autoInstallOnAppQuit: true, allowDowngrade: true
  });
  const emit = vi.fn(); const factory = vi.fn(() => native as never);
  const service = new NativeUpdater(runtime, emit, factory);
  return { native, emit, factory, service };
}
it("pins the native feed to the checked official release and rejects mismatched tags", () => {
  expect(updateFeed(update)).toEqual({ url: "https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.6/", channel: "alpha" });
  for (const url of ["https://evil.test/", update.url + "?x=1", update.url.replace("alpha.6", "alpha.7")]) expect(() => updateFeed({ ...update, url })).toThrow();
});
it("downloads with progress and installs only after an explicit second action", async () => {
  const h = harness(); expect(() => h.service.install()).toThrow();
  await h.service.download(update);
  expect(h.native.autoDownload).toBe(false); expect(h.native.autoInstallOnAppQuit).toBe(false); expect(h.native.allowDowngrade).toBe(false);
  expect(h.emit.mock.calls.some(([state]) => state.percent === 42)).toBe(true);
  expect(h.service.state.phase).toBe("downloaded"); expect(JSON.stringify(h.service.state)).not.toContain("/private/");
  expect(h.native.quitAndInstall).not.toHaveBeenCalled(); h.service.install(); expect(h.native.quitAndInstall).toHaveBeenCalledOnce();
  expect(() => h.service.install()).toThrow();
});
it("rejects a manifest for a different version and never downloads or installs it", async () => {
  const h = harness("1.0.0"); await expect(h.service.download(update)).rejects.toThrow();
  expect(h.native.downloadUpdate).not.toHaveBeenCalled(); expect(h.service.state.phase).toBe("error"); expect(() => h.service.install()).toThrow();
});
it("fails closed on download or integrity failure", async () => {
  const h = harness(); h.native.downloadUpdate.mockRejectedValueOnce(new Error("checksum mismatch"));
  await expect(h.service.download(update)).rejects.toThrow(); expect(h.service.state.phase).toBe("error"); expect(() => h.service.install()).toThrow();
});
it("does not enable native replacement in development or portable Windows", async () => {
  const factory = vi.fn();
  for (const changed of [{ packaged: false }, { portable: true }, { platform: "linux", appImage: false }]) {
    const service = new NativeUpdater({ ...runtime, ...changed }, vi.fn(), factory);
    expect(service.state.supported).toBe(false); await expect(service.download(update)).rejects.toThrow();
  }
  expect(factory).not.toHaveBeenCalled();
});
