import { UpdateChecker } from "../services/update-checker.js";
import { parseProfileDataMutation } from "../../../../packages/ipc/profile-data-contract.js";
import { runShutdown } from "./shutdown.js";
import { LocalDiagnostics } from "../services/local-diagnostics.js";
import { installLocalDiagnostics } from "../services/local-diagnostics.js";
import { DEFAULT_FEATURE_FLAGS, featureEnabled } from "../../../../config/feature-flags.js";
import { registerResearchIpc } from "../ipc/research-ipc.js";
import { changeInterfaceZoom, installInterfaceWheel, installZoomShortcuts } from "./interface-zoom.js";
import { NativeUpdater } from "../services/native-updater.js";
import { app, ipcMain, shell, dialog } from "electron";
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
const ipc = new IpcRouter(windows);
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
  installZoomShortcuts(window.webContents, action => browser.zoomActivePage(id, action));
  installInterfaceWheel(window.webContents, window.webContents);

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
  if (privateMode) await application?.createTab(id, { active: true, private: true, sessionId: id });
  else await application?.restoreWindow(id);
  await window.loadFile(join(appRoot, "index.html"));
}

app.whenReady().then(async () => {
  installLocalDiagnostics(app);
  const offlineTest = process.env.NODE_ENV === "test" && process.env.MOON_TEST_OFFLINE === "1";
  const updates = new UpdateChecker(app.getVersion());
  ipc.register("updates:check", event => { updateWindow(event); return offlineTest ? null : updates.check(); });
  const nativeUpdates = new NativeUpdater({ packaged: app.isPackaged, platform: process.platform, portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR), appImage: Boolean(process.env.APPIMAGE), moon: app.getVersion(), chromium: process.versions.chrome, electron: process.versions.electron }, state => {
    for (const window of windows.list()) {
      const id = windows.idForWebContents(window.webContents);
      if (id && !windows.isPrivate(id) && !windows.isGuest(id)) window.webContents.send("updates:state", state);
    }
  });
  const updateWindow = (event: Electron.IpcMainInvokeEvent): string => {
    const id = windows.idForWebContents(event.sender);
    if (!id || windows.isPrivate(id) || windows.isGuest(id)) throw new Error("Atualize em uma janela normal do Moon.");
    return id;
  };
  ipc.register("updates:status", event => { updateWindow(event); return nativeUpdates.state; });
  ipc.register("updates:download", async event => {
    updateWindow(event);
    if (!updates.available) throw new Error("No checked update is available");
    if (nativeUpdates.state.supported) await nativeUpdates.download(updates.available);
    else await shell.openExternal(updates.available.url);
  });
  ipc.register("updates:open-page", async event => { updateWindow(event); if (!updates.available) throw new Error("No checked update is available"); await shell.openExternal(updates.available.url); });
  ipc.register("updates:install", async event => {
    const id = updateWindow(event);
    if (nativeUpdates.state.phase !== "downloaded") throw new Error("Nenhuma atualização pronta.");
    const confirmation = await dialog.showMessageBox(windows.require(id), { type: "question", title: "Atualizar Moon e Chromium", message: "Salvou seu trabalho?", detail: "O Moon será fechado para abrir o instalador oficial. O motor Chromium é atualizado junto do aplicativo. Esta pré-release não possui promessa de assinatura digital do instalador.", buttons: ["Cancelar", "Instalar e reiniciar"], defaultId: 0, cancelId: 0 });
    if (confirmation.response === 1) nativeUpdates.install();
  });
  const testProfileDirectory = process.env.NODE_ENV === "test" ? process.env.MOON_TEST_PROFILE_DIR : undefined;
  const defaultDirectory = testProfileDirectory ?? join(app.getPath("userData"), "profile");
  const profilesDirectory = testProfileDirectory ? join(testProfileDirectory, "profiles") : join(app.getPath("userData"), "profiles");
  profiles = new LocalProfileManager(profilesDirectory, defaultDirectory);
  defaultProfileId = (await profiles.initialize()).id;
  application = new BrowserApplicationService(browser, windowId => profiles!.storage(windows.profileId(windowId)));
  installApplicationMenu(() => { void createMainWindow(true, defaultProfileId); }, (window, action) => {
    const id = windows.idForWebContents(window.webContents); if (id) browser.zoomActivePage(id, action);
  });
  ipcMain.on("browser:ui-wheel", (event, direction: unknown) => {
    if (direction !== "in" && direction !== "out") return;
    if (event.sender.isDestroyed() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame || event.senderFrame.detached) return;
    const id = browser.windowIdForContents(event.sender); const window = id ? windows.get(id) : undefined;
    if (window) setImmediate(() => changeInterfaceZoom(window.webContents, direction));
  });
  registerBrowserIpc(ipc, application, windows, profileId => createMainWindow(true, profileId));
  ipc.register("workspace:delete", async (event, payload: unknown) => {
    const mutation = parseProfileDataMutation(payload);
    if (mutation.type !== "workspace:delete") throw new TypeError("Invalid workspace command");
    const source = windows.idForWebContents(event.sender)!;
    if (windows.isPrivate(source) || windows.isGuest(source)) throw new Error("Use a normal window to delete areas");
    const profileId = windows.profileId(source);
    const storage = await profiles!.storage(profileId);
    const areas = (await storage.loadProfileData()).workspaces;
    if (!areas.some(area => area.id === mutation.id) || !areas.some(area => area.id !== mutation.id && !area.archived)) throw new Error("Keep at least one active workspace");
    if (!mutation.tabs || (mutation.tabs === "move" && !areas.some(area => area.id === mutation.targetId && area.id !== mutation.id && !area.archived))) throw new Error("Choose how to handle the tabs and an active destination");
    if (application!.deletingAreas.has(mutation.id)) throw new Error("Workspace deletion in progress");
    application!.deletingAreas.add(mutation.id);
    try {
    for (const window of windows.list()) {
      const id = windows.idForWebContents(window.webContents)!;
      if (windows.profileId(id) === profileId) window.webContents.send("workspace:deleting", { source: mutation.id, target: mutation.targetId ?? areas.find(area => area.id !== mutation.id && !area.archived)!.id });
    }
    for (const window of windows.list()) {
      const id = windows.idForWebContents(window.webContents)!;
      if (windows.profileId(id) !== profileId) continue;
      if (mutation.tabs === "move") browser.moveWorkspaceTabs(id, mutation.id, mutation.targetId!);
      else for (const tab of await application!.getTabs(id)) if (tab.workspaceId === mutation.id) await application!.closeTab(tab.id);
      await application!.flushWindow(id);
    }
    await storage.applyProfileMutation(mutation);
    } finally {
    application!.deletingAreas.delete(mutation.id);
    for (const window of windows.list()) {
      const id = windows.idForWebContents(window.webContents)!;
      if (windows.profileId(id) === profileId) window.webContents.send("workspace:changed");
    }
    }
  });
  registerProductIpc(ipc, downloads, adblock, profiles, windows, app.getPath("home"), app.getVersion(), profileId => createMainWindow(false, profileId));
  if (featureEnabled(DEFAULT_FEATURE_FLAGS, "research")) registerResearchIpc(ipc, windows, browser, application, profiles);
  registerApplicationLifecycle(windows, createMainWindow);
  await createMainWindow();
  if (!offlineTest) void adblock.initialize();
}).catch(error => {
  // Closing during loadFile aborts navigation; it is not a startup failure.
  if (shutdownStarted) return;
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
  const diagnostics = new LocalDiagnostics(join(app.getPath("userData"), "diagnostics"), process.env.MOON_LOCAL_DIAGNOSTICS === "1");
  void runShutdown([
    { name: "flush-and-destroy-tabs", run: () => application!.shutdown() },
    { name: "close-profiles", run: async () => { await profiles?.close(); } }
  ], {
    timeoutMs: 5_000,
    timedOut: stage => {
      console.error("Moon shutdown deadline exceeded", stage);
      void diagnostics.record("shutdown-timeout", { stage });
      app.exit(1);
    },
    failed: stage => { console.error("Moon shutdown step failed", stage); void diagnostics.record("shutdown-failed", { stage }); }
  }).then(completed => {
    if (!completed) return;
    shutdownComplete = true;
    app.quit();
  });
});
