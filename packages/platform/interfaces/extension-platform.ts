export type ExtensionPermission =
  | "tabs"
  | "activeTab"
  | "storage"
  | "history"
  | "bookmarks"
  | "notifications"
  | "contextMenus"
  | "scripting"
  | "webNavigation"
  | "webRequest"
  | "webRequestBlocking"
  | "cookies"
  | "downloads"
  | "clipboardRead"
  | "clipboardWrite"
  | "sessions"
  | "management";

export type ExtensionState =
  | "installed"
  | "enabled"
  | "disabled"
  | "error"
  | "uninstalled";

export interface ExtensionManifest {
  readonly manifestVersion: number;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly permissions: readonly ExtensionPermission[];
  readonly hostPermissions: readonly string[];
  readonly background?: {
    readonly serviceWorker?: string;
    readonly scripts?: readonly string[];
  };
  readonly contentScripts?: readonly {
    readonly matches: readonly string[];
    readonly js?: readonly string[];
    readonly css?: readonly string[];
    readonly runAt?: "document_start" | "document_end" | "document_idle";
  }[];
  readonly action?: {
    readonly defaultTitle?: string;
    readonly defaultPopup?: string;
  };
  readonly optionsPage?: string;
}

export interface InstalledExtension {
  readonly id: string;
  readonly manifest: ExtensionManifest;
  readonly state: ExtensionState;
  readonly installPath: string;
  readonly installedAt: number;
  readonly updatedAt: number;
}

export interface ExtensionPermissionRequest {
  readonly extensionId: string;
  readonly permission: ExtensionPermission;
  readonly origin?: string;
  readonly reason?: string;
}

export interface ExtensionPermissionResult {
  readonly extensionId: string;
  readonly permission: ExtensionPermission;
  readonly granted: boolean;
}

export interface ExtensionPlatform {
  install(
    packagePath: string
  ): Promise<InstalledExtension>;

  uninstall(
    extensionId: string
  ): Promise<void>;

  enable(
    extensionId: string
  ): Promise<void>;

  disable(
    extensionId: string
  ): Promise<void>;

  reload(
    extensionId: string
  ): Promise<void>;

  get(
    extensionId: string
  ): Promise<InstalledExtension | null>;

  list(): Promise<readonly InstalledExtension[]>;

  requestPermission(
    request: ExtensionPermissionRequest
  ): Promise<ExtensionPermissionResult>;

  getPermission(
    extensionId: string,
    permission: ExtensionPermission
  ): Promise<boolean>;

  grantPermission(
    extensionId: string,
    permission: ExtensionPermission
  ): Promise<void>;

  revokePermission(
    extensionId: string,
    permission: ExtensionPermission
  ): Promise<void>;

  executeScript(
    extensionId: string,
    tabId: string,
    script: string
  ): Promise<unknown>;

  sendMessage(
    extensionId: string,
    message: unknown
  ): Promise<unknown>;

  shutdown(): Promise<void>;
}