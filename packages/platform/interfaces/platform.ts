import type { BrowserPlatform } from "./browser-platform.js";
import type { ClipboardPlatform } from "./clipboard-platform.js";
import type { DownloadPlatform } from "./download-platform.js";
import type { ExtensionPlatform } from "./extension-platform.js";
import type { FilesystemPlatform } from "./filesystem-platform.js";
import type { NetworkPlatform } from "./network-platform.js";
import type { NotificationPlatform } from "./notification-platform.js";
import type { PermissionPlatform } from "./permission-platform.js";
import type { SecurityPlatform } from "./security-platform.js";
import type { StoragePlatform } from "./storage-platform.js";

export interface Platform {
  readonly browser: BrowserPlatform;
  readonly clipboard: ClipboardPlatform;
  readonly downloads: DownloadPlatform;
  readonly extensions: ExtensionPlatform;
  readonly filesystem: FilesystemPlatform;
  readonly network: NetworkPlatform;
  readonly notifications: NotificationPlatform;
  readonly permissions: PermissionPlatform;
  readonly security: SecurityPlatform;
  readonly storage: StoragePlatform;

  readonly name: string;
  readonly version: string;
  readonly type: "desktop" | "mobile";
  readonly os: string;
  readonly architecture: string;
}