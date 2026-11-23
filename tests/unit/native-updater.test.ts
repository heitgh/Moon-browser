import { EventEmitter } from "node:events";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("electron-updater", () => ({ default: {} }));
import { NativeUpdater, updateFeed } from "../../apps/desktop/electron/services/native-updater.js";
import { appImageAssetName } from "../../apps/desktop/electron/services/update-signature.js";
const update = { version: "v0.6.0-alpha.6", url: "https://github.com/heitgh/Moon-browser/releases/tag/v0.6.0-alpha.6", notes: "" };
const runtime = { packaged: true, platform: "win32", portable: false, appImage: false, signedWindowsRelease: true, moon: "0.6.0-alpha.5", chromium: "test", electron: "test" };
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
  for (const changed of [{ packaged: false }, { portable: true }, { signedWindowsRelease: false }, { platform: "linux", appImage: false }, { platform: "linux", appImage: true }]) {
    const service = new NativeUpdater({ ...runtime, ...changed }, vi.fn(), factory);
    expect(service.state.supported).toBe(false); await expect(service.download(update)).rejects.toThrow();
  }
  expect(factory).not.toHaveBeenCalled();
});
it("does not offer AppImage installation until the downloaded file has a valid publisher signature", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-native-signature-"));
  const path = join(directory, appImageAssetName(update.version));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const data = Buffer.from("test AppImage");
  const signature = sign(null, createHash("sha256").update(data).digest(), privateKey);
  const native = Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn(async () => ({ updateInfo: { version: "0.6.0-alpha.6" } })),
    downloadUpdate: vi.fn(async () => [path]), quitAndInstall: vi.fn()
  });
  const factory = () => native as never;
  const linux = { ...runtime, platform: "linux", appImage: true, linuxUpdatePublicKey: publicKey.export({ type: "spki", format: "pem" }).toString() };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(signature)));
  try {
    await writeFile(path, data);
    const valid = new NativeUpdater(linux, vi.fn(), factory);
    expect(valid.state.supported).toBe(true);
    await valid.download(update);
    expect(valid.state.phase).toBe("downloaded");
    await writeFile(path, "tampered");
    const invalid = new NativeUpdater(linux, vi.fn(), factory);
    await expect(invalid.download(update)).rejects.toThrow();
    expect(invalid.state.phase).toBe("error");
    expect(() => invalid.install()).toThrow();
  } finally { vi.unstubAllGlobals(); await rm(directory, { recursive: true, force: true }); }
});
