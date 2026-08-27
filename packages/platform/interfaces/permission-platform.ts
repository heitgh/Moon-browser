export type PlatformPermission =
  | "camera"
  | "microphone"
  | "geolocation"
  | "notifications"
  | "clipboard-read"
  | "clipboard-write"
  | "filesystem-read"
  | "filesystem-write"
  | "downloads"
  | "fullscreen"
  | "media"
  | "midi"
  | "pointer-lock"
  | "screen-capture";

export type PlatformPermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "unavailable";

export interface PlatformPermissionRequest {
  readonly permission: PlatformPermission;
  readonly origin?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly userInitiated?: boolean;
  readonly reason?: string;
}

export interface PlatformPermissionResult {
  readonly permission: PlatformPermission;
  readonly state: PlatformPermissionState;
  readonly origin?: string;
  readonly decidedAt: number;
}

export interface PermissionPlatform {
  request(
    request: PlatformPermissionRequest
  ): Promise<PlatformPermissionResult>;

  query(
    permission: PlatformPermission,
    origin?: string
  ): Promise<PlatformPermissionState>;

  grant(
    permission: PlatformPermission,
    origin?: string
  ): Promise<void>;

  deny(
    permission: PlatformPermission,
    origin?: string
  ): Promise<void>;

  reset(
    permission: PlatformPermission,
    origin?: string
  ): Promise<void>;

  resetAll(
    origin?: string
  ): Promise<void>;

  list(
    origin?: string
  ): Promise<readonly PlatformPermissionResult[]>;

  isSupported(
    permission: PlatformPermission
  ): Promise<boolean>;

  shutdown(): Promise<void>;
}