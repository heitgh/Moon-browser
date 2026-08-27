import { app } from "electron";
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
import { ProfileStorage } from "../services/profile-storage.js";
import { BrowserApplicationService } from "../../application/browser-application-service.js";
import { MoonThemeService } from "../services/moon-theme-service.js";

const windows = new WindowManager();
const downloads = new ElectronDownloadManager(windows);
const adblock = new ElectronAdblockService(windows);
const browser = new ElectronBrowserManager(windows, downloads, adblock);
const ipc = new IpcRouter();
let profile: ProfileStorage | undefined;
let application: BrowserApplicationService | undefined;

async function createMainWindow(): Promise<void> {
  const appRoot = app.getAppPath();
  const id = windows.create({
    webPreferences: {
      preload: join(appRoot, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });
  const window = windows.require(id);

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => {
    if (event.url !== window.webContents.getURL()) event.preventDefault();
  });
  window.once("close", () => {
    if (application?.shuttingDown) return;
    void application?.flushWindow(id).finally(() => { void browser.closeTabsForWindow(id); });
  });
  await application?.restoreWindow(id);
  await window.loadFile(join(appRoot, "index.html"));
}

app.whenReady().then(async () => {
  const testProfileDirectory = process.env.NODE_ENV === "test" ? process.env.MOON_TEST_PROFILE_DIR : undefined;
  profile = new ProfileStorage(testProfileDirectory ?? join(app.getPath("userData"), "profile"));
  await profile.open();
  const themes = new MoonThemeService(profile, app.getVersion());
  application = new BrowserApplicationService(browser, profile);
  installApplicationMenu();
  registerBrowserIpc(ipc, application, windows);
  registerProductIpc(ipc, downloads, adblock, profile, themes);
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
    .finally(() => {
      shutdownComplete = true;
      app.quit();
    });
});
