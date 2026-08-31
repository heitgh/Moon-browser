export interface Tab {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly active: boolean;
  readonly loading: boolean;
  readonly faviconUrl?: string;
  readonly workspaceId?: string;
  readonly private: boolean;
}

export interface Navigation {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export interface TabUpdate {
  readonly tab: Tab;
  readonly navigation: Navigation;
  readonly error?: string;
}

export interface Workspace { readonly id: string; readonly name: string; }
export interface SavedLink { readonly id: string; readonly title: string; readonly url: string; readonly time: number; }
export interface Shortcut { readonly id: string; readonly name: string; readonly url: string; readonly openIn?: "current" | "new"; }
export interface SavedTheme { readonly id: string; readonly name: string; readonly accent: string; readonly wallpaper: string; readonly glassHome: boolean; }
export type SearchEngine = "duckduckgo" | "google" | "brave";
export interface Preferences { readonly accent: string; readonly wallpaper: string; readonly searchEngine: SearchEngine; readonly showClock: boolean; readonly showShortcuts: boolean; readonly glassHome: boolean; }
export interface ManagedDownload { readonly id: string; readonly url: string; readonly filename: string; readonly savePath: string; readonly state: "in-progress" | "paused" | "completed" | "cancelled" | "failed"; readonly receivedBytes: number; readonly totalBytes: number; readonly speedBytesPerSecond: number; readonly percentage: number | null; readonly startedAt: number; readonly completedAt?: number; }
export interface AdblockStatus { readonly phase: "loading" | "active" | "disabled" | "failed"; readonly enabled: boolean; readonly blockedCount: number; readonly error?: string; }
export interface PermissionRequest { readonly id: string; readonly origin: string; readonly permission: string; }
export interface MoonThemeSummary { readonly id: string; readonly packageId: string; readonly name: string; readonly version: string; readonly author: string; readonly trust: "official" | "local"; readonly active: boolean; readonly installedAt: number; }
export interface MoonThemePayload { readonly summary: MoonThemeSummary; readonly tokens: import("../../packages/theme-contract/types.js").MoonThemeTokens; readonly wallpaperData?: string; readonly iconData?: Readonly<Partial<Record<"logo" | "newTab" | "privateTab", string>>>; }
export interface MoonThemePreview extends MoonThemeSummary { readonly intentId: string; readonly description?: string; readonly changes: readonly string[]; readonly tokens: import("../../packages/theme-contract/types.js").MoonThemeTokens; readonly wallpaperData?: string; readonly iconData?: Readonly<Partial<Record<"logo" | "newTab" | "privateTab", string>>>; }
export type Drawer = "profiles" | "workspaces" | "bookmarks" | "downloads" | "history" | "translate" | "notes" | "focus" | "extensions" | "ai" | "security";
export type { ProfileDataMutation, ProfileDataSnapshot } from "../../packages/ipc/profile-data-contract.js";
import type { ProfileDataMutation, ProfileDataSnapshot } from "../../packages/ipc/profile-data-contract.js";
import type { SitePermissionRecord } from "../../packages/ipc/site-permission-contract.js";
export type { SitePermissionRecord } from "../../packages/ipc/site-permission-contract.js";
import type { ImportResult, ImportSelection, ImportSourceSummary } from "../../packages/ipc/browser-import-contract.js";
import type { CustomizationSchemaV4 } from "../customization/customization-schema.js";
export type { LocalProfileAvatar, LocalProfileSummary } from "../../packages/ipc/local-profile-contract.js";
import type { CreateLocalProfileRequest, DeleteLocalProfileRequest, LocalProfileSummary, UpdateLocalProfileRequest } from "../../packages/ipc/local-profile-contract.js";

export interface MoonBrowserBridge {
  createTab(url?: string, workspaceId?: string): Promise<Tab>;
  getWindowContext(): Promise<{ readonly private: boolean; readonly guest: boolean; readonly profileId: string }>;
  createPrivateWindow(): Promise<void>;
  getTabs(): Promise<readonly Tab[]>;
  closeTab(tabId: string): Promise<void>;
  activateTab(tabId: string): Promise<void>;
  showHome(tabId: string): Promise<void>;
  showInternalPage(tabId: string, url: string): Promise<void>;
  navigate(tabId: string, url: string): Promise<void>;
  back(tabId: string): Promise<void>;
  forward(tabId: string): Promise<void>;
  reload(tabId: string, bypassCache?: boolean): Promise<void>;
  stop(tabId: string): Promise<void>;
  setBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  setContentVisible(visible: boolean): Promise<void>;
  setSearchTemplate(template: string): Promise<void>;
  respondToPermission(requestId: string, granted: boolean): Promise<void>;
  listSitePermissions(): Promise<readonly SitePermissionRecord[]>;
  clearSitePermission(origin: string, permission: string): Promise<void>;
  getDownloads(): Promise<readonly ManagedDownload[]>;
  pauseDownload(id: string): Promise<void>;
  resumeDownload(id: string): Promise<void>;
  cancelDownload(id: string): Promise<void>;
  openDownload(id: string): Promise<void>;
  showDownloadInFolder(id: string): Promise<void>;
  clearFinishedDownloads(): Promise<void>;
  getAdblockStatus(): Promise<AdblockStatus>;
  setAdblockEnabled(enabled: boolean): Promise<AdblockStatus>;
  exportProductData(content: string): Promise<boolean>;
  importProductData(): Promise<string | null>;
  exportCustomization(content: string): Promise<boolean>;
  exportSettingsDiagnostic(content: string): Promise<boolean>;
  importCustomization(): Promise<string | null>;
  exportMoonHome(content: string): Promise<boolean>;
  importMoonHome(): Promise<string | null>;
  fetchWallpaper(url: string): Promise<string>;
  fetchFavicon(url: string): Promise<string>;
  migrateLegacyProfile(content: string): Promise<{ readonly migrated: boolean; readonly version: number }>;
  loadCustomization(legacy?: unknown): Promise<CustomizationSchemaV4>;
  commitCustomization(document: CustomizationSchemaV4): Promise<CustomizationSchemaV4>;
  getProfileData(): Promise<ProfileDataSnapshot>;
  mutateProfileData(mutation: ProfileDataMutation): Promise<void>;
  listLocalProfiles(): Promise<readonly LocalProfileSummary[]>;
  createLocalProfile(profile: CreateLocalProfileRequest): Promise<LocalProfileSummary>;
  updateLocalProfile(profile: UpdateLocalProfileRequest): Promise<LocalProfileSummary>;
  openLocalProfile(id: string): Promise<LocalProfileSummary>;
  createGuestProfile(): Promise<LocalProfileSummary>;
  getLocalProfileDeletionSummary(id: string): Promise<{ readonly profile: LocalProfileSummary; readonly directoryName: string; readonly includes: readonly string[] }>;
  deleteLocalProfile(request: DeleteLocalProfileRequest): Promise<{ readonly id: string; readonly backupPath?: string }>;
  discoverImportSources(): Promise<readonly ImportSourceSummary[]>;
  importBrowserProfile(selection: ImportSelection): Promise<ImportResult>;
  importBookmarksHtml(): Promise<ImportResult | null>;
  importMoonTheme(): Promise<MoonThemePreview | null>;
  confirmMoonTheme(intentId: string): Promise<MoonThemeSummary>;
  cancelMoonTheme(intentId: string): Promise<void>;
  listMoonThemes(): Promise<readonly MoonThemeSummary[]>;
  applyMoonTheme(id: string): Promise<MoonThemePayload>;
  activateMoonTheme(id: string): Promise<MoonThemeSummary>;
  rollbackMoonTheme(packageId: string): Promise<MoonThemePayload>;
  removeMoonTheme(id: string): Promise<void>;
  exportMoonTheme(id: string): Promise<boolean>;
  onTabUpdated(listener: (update: TabUpdate) => void): () => void;
  onTabClosed(listener: (event: { readonly tabId: string }) => void): () => void;
  onDownloadsUpdated(listener: (downloads: readonly ManagedDownload[]) => void): () => void;
  onAdblockStatus(listener: (status: AdblockStatus) => void): () => void;
  onPermissionRequested(listener: (request: PermissionRequest) => void): () => void;
}

export function moonBrowserBridge(): MoonBrowserBridge | undefined {
  return (window as unknown as { readonly moonBrowser?: MoonBrowserBridge }).moonBrowser;
}
