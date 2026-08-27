import type { ClipboardPlatform, DownloadPlatform, FilesystemPlatform, NotificationPlatform, PermissionPlatform, Platform } from "@moon/platform";
import type { ElectronBrowserPlatform } from "./electron-browser.js";
import type { ElectronExtensionPlatform } from "./electron-extensions.js";
import type { ElectronNetworkPlatform } from "./electron-network.js";
import type { ElectronSecurityPlatform } from "./electron-security.js";
import type { ElectronStoragePlatform } from "./electron-storage.js";
export interface ElectronPlatformServices { readonly browser: ElectronBrowserPlatform; readonly clipboard: ClipboardPlatform; readonly downloads: DownloadPlatform; readonly extensions: ElectronExtensionPlatform; readonly filesystem: FilesystemPlatform; readonly network: ElectronNetworkPlatform; readonly notifications: NotificationPlatform; readonly permissions: PermissionPlatform; readonly security: ElectronSecurityPlatform; readonly storage: ElectronStoragePlatform; }
export function createElectronPlatform(services: ElectronPlatformServices): Platform { return { ...services, name: "Moon Desktop", version: "0.1.0", type: "desktop", os: process.platform, architecture: process.arch }; }
