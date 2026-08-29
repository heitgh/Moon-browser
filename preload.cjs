const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);
const subscribe = (channel, listener) => {
  if (typeof listener !== "function") throw new TypeError("Listener must be a function");
  const handler = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld("moonBrowser", Object.freeze({
  createTab: (url, workspaceId) => invoke("browser:create-tab", {
    ...(url ? { url } : {}),
    ...(workspaceId ? { workspaceId } : {})
  }),
  getWindowContext: () => invoke("browser:get-window-context"),
  createPrivateWindow: () => invoke("browser:create-private-window"),
  getTabs: () => invoke("browser:get-tabs"),
  closeTab: tabId => invoke("browser:close-tab", { tabId }),
  activateTab: tabId => invoke("browser:activate-tab", { tabId }),
  showHome: tabId => invoke("browser:show-home", { tabId }),
  showInternalPage: (tabId, url) => invoke("browser:show-internal-page", { tabId, url }),
  navigate: (tabId, url) => invoke("browser:navigate", { tabId, url }),
  back: tabId => invoke("browser:back", { tabId }),
  forward: tabId => invoke("browser:forward", { tabId }),
  reload: (tabId, bypassCache = false) => invoke("browser:reload", { tabId, bypassCache }),
  stop: tabId => invoke("browser:stop", { tabId }),
  setBounds: bounds => invoke("browser:set-bounds", bounds),
  setContentVisible: visible => invoke("browser:set-content-visible", { visible }),
  setSearchTemplate: template => invoke("browser:set-search-template", { template }),
  respondToPermission: (requestId, granted) => invoke("browser:respond-permission", { requestId, granted }),
  listSitePermissions: () => invoke("browser:list-site-permissions"),
  clearSitePermission: (origin, permission) => invoke("browser:clear-site-permission", { origin, permission }),
  getDownloads: () => invoke("download:list"),
  pauseDownload: id => invoke("download:pause", { id }),
  resumeDownload: id => invoke("download:resume", { id }),
  cancelDownload: id => invoke("download:cancel", { id }),
  openDownload: id => invoke("download:open", { id }),
  showDownloadInFolder: id => invoke("download:show-in-folder", { id }),
  clearFinishedDownloads: () => invoke("download:clear-finished"),
  getAdblockStatus: () => invoke("adblock:get-status"),
  setAdblockEnabled: enabled => invoke("adblock:set-enabled", { enabled }),
  exportProductData: content => invoke("product:export-data", { content }),
  importProductData: () => invoke("product:import-data"),
  exportCustomization: content => invoke("product:export-customization", { content }),
  exportSettingsDiagnostic: content => invoke("product:export-settings-diagnostic", { content }),
  importCustomization: () => invoke("product:import-customization"),
  fetchWallpaper: url => invoke("product:fetch-wallpaper", { url }),
  fetchFavicon: url => invoke("product:fetch-favicon", { url }),
  migrateLegacyProfile: content => invoke("product:migrate-legacy-profile", { content }),
  loadCustomization: legacy => invoke("customization:load", { legacy }),
  commitCustomization: document => invoke("customization:commit", { document }),
  getProfileData: () => invoke("profile:get-data"),
  mutateProfileData: mutation => invoke("profile:mutate", mutation),
  discoverImportSources: () => invoke("import:discover"),
  importBrowserProfile: selection => invoke("import:run", selection),
  importBookmarksHtml: () => invoke("import:bookmarks-html"),
  importMoonTheme: () => invoke("theme:import"),
  confirmMoonTheme: intentId => invoke("theme:confirm", { intentId }),
  cancelMoonTheme: intentId => invoke("theme:cancel", { intentId }),
  listMoonThemes: () => invoke("theme:list"),
  applyMoonTheme: id => invoke("theme:apply", { id }),
  activateMoonTheme: id => invoke("theme:activate", { id }),
  rollbackMoonTheme: packageId => invoke("theme:rollback", { packageId }),
  removeMoonTheme: id => invoke("theme:remove", { id }),
  exportMoonTheme: id => invoke("theme:export", { id }),
  onTabUpdated: listener => subscribe("browser:tab-updated", listener),
  onTabClosed: listener => subscribe("browser:tab-closed", listener),
  onDownloadsUpdated: listener => subscribe("download:updated", listener),
  onAdblockStatus: listener => subscribe("adblock:status", listener),
  onPermissionRequested: listener => subscribe("browser:permission-requested", listener)
}));
