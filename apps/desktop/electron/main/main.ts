import { app } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ElectronBrowserManager } from "../browser/browser-manager.js";
import { registerBrowserIpc } from "../ipc/browser-ipc.js";
import { registerProductIpc } from "../ipc/product-ipc.js";
import { IpcRouter } from "../ipc/ipc-router.js";
import { registerApplicationLifecycle } from "./app-lifecycle.js";
import { installApplicationMenu } from "./application-menu.js";
import { WindowManager } from "./window-manager.js";
import { ElectronAdblockService } from "../services/adblock-service.js";
import { ElectronDownloadManager } from "../services/download-manager.js";
import { BrowserApplicationService } from "../../application/browser-application-service.js";
import { SessionRequestPipeline } from "../security/session-request-pipeline.js";
import { SitePermissionService } from "../security/site-permission-service.js";
import { LocalProfileManager } from "../services/local-profile-manager.js";

const windows = new WindowManager();
const downloads = new ElectronDownloadManager(windows);
const requestPipeline = new SessionRequestPipeline();
const permissions = new Map<string, SitePermissionService>();
const adblock = new ElectronAdblockService(windows, requestPipeline);
const browser = new ElectronBrowserManager(windows, downloads, adblock, requestPipeline, windowId => permissions.get(windows.profileId(windowId)));
const ipc = new IpcRouter();
let profiles: LocalProfileManager | undefined;
let application: BrowserApplicationService | undefined;
let defaultProfileId = "default";

async function ensureProfilePermissions(profileId: string): Promise<void> {
  if (permissions.has(profileId)) return;
  if (!profiles) throw new Error("Profile manager is not ready");
  const service = new SitePermissionService();
  await service.hydrate(await profiles.storage(profileId));
  permissions.set(profileId, service);
}

async function createMainWindow(privateMode = false, profileId = defaultProfileId): Promise<void> {
  if (!profiles) throw new Error("Profile manager is not ready");
  const localProfile = profiles.require(profileId);
  await ensureProfilePermissions(profileId);
  const appRoot = app.getAppPath();
  const id = windows.create({
    title: privateMode ? `Moon Browser — Janela anônima · ${localProfile.name}` : `Moon Browser — ${localProfile.name}`,
    backgroundColor: privateMode ? "#11101a" : "#090a10",
    webPreferences: {
      preload: join(appRoot, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      partition: privateMode
        ? `moon-shell-private:${randomUUID()}`
        : localProfile.kind === "guest"
          ? `moon-shell:${profileId}`
          : `persist:moon-shell:${profileId}`
    }
  }, { private: privateMode, guest: localProfile.kind === "guest", profileId });
  const window = windows.require(id);

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => {
    if (event.url !== window.webContents.getURL()) event.preventDefault();
  });
  window.once("close", () => {
    if (application?.shuttingDown) return;
    void application?.closeWindow(id).catch(error => console.error("Window profile flush failed", error));
  });
  window.once("closed", () => {
    if (localProfile.kind === "guest" && !windows.hasProfileWindows(profileId)) {
      permissions.delete(profileId);
      void profiles?.releaseGuest(profileId).catch(error => console.error("Guest profile cleanup failed", error));
    }
  });
  if (!privateMode) await application?.restoreWindow(id);
  await window.loadFile(join(appRoot, "index.html"));
}

app.whenReady().then(async () => {
  const testProfileDirectory = process.env.NODE_ENV === "test" ? process.env.MOON_TEST_PROFILE_DIR : undefined;
  const defaultDirectory = testProfileDirectory ?? join(app.getPath("userData"), "profile");
  const profilesDirectory = testProfileDirectory ? join(testProfileDirectory, "profiles") : join(app.getPath("userData"), "profiles");
  profiles = new LocalProfileManager(profilesDirectory, defaultDirectory);
  defaultProfileId = (await profiles.initialize()).id;
  application = new BrowserApplicationService(browser, windowId => profiles!.storage(windows.profileId(windowId)));
  installApplicationMenu(() => { void createMainWindow(true, defaultProfileId); });
  registerBrowserIpc(ipc, application, windows, profileId => createMainWindow(true, profileId));
  registerProductIpc(ipc, downloads, adblock, profiles, windows, app.getPath("home"), app.getVersion(), profileId => createMainWindow(false, profileId));
  registerApplicationLifecycle(windows, createMainWindow);
  await createMainWindow();
  void adblock.initialize();
}).catch(error => {
  console.error("Moon failed to start", error);
  app.exit(1);
});

let shutdownStarted = false;
let shutdownComplete = false;
app.on("before-quit", event => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  ipc.dispose();
  if (!application) {
    shutdownComplete = true;
    app.quit();
    return;
  }
  void application.shutdown()
    .catch(error => console.error("Moon shutdown failed", error))
    .finally(async () => {
      await profiles?.close().catch(error => console.error("Profile shutdown failed", error));
      shutdownComplete = true;
      app.quit();
    });
});
