export type SecurityPermission =
  | "camera"
  | "microphone"
  | "geolocation"
  | "notifications"
  | "clipboard-read"
  | "clipboard-write"
  | "downloads"
  | "fullscreen"
  | "media"
  | "popups"
  | "autoplay"
  | "storage"
  | "background-sync";

export type PermissionDecision =
  | "allow"
  | "deny"
  | "ask";

export type SecurityIsolationLevel =
  | "strict"
  | "standard"
  | "relaxed";

export interface PermissionRequest {
  readonly id: string;
  readonly permission: SecurityPermission;
  readonly origin: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly timestamp: number;
}

export interface PermissionResult {
  readonly permission: SecurityPermission;
  readonly decision: PermissionDecision;
  readonly origin: string;
}

export interface SecurityPolicy {
  readonly isolationLevel: SecurityIsolationLevel;
  readonly blockInsecureContent: boolean;
  readonly blockMixedContent: boolean;
  readonly blockPopups: boolean;
  readonly preventFingerprinting: boolean;
  readonly preventTracking: boolean;
  readonly clearDataOnExit: boolean;
  readonly allowThirdPartyCookies: boolean;
}

export interface SecurityAuditEvent {
  readonly id: string;
  readonly type:
    | "permission"
    | "navigation"
    | "network"
    | "extension"
    | "storage"
    | "isolation"
    | "policy";
  readonly origin?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly description: string;
  readonly timestamp: number;
}

export interface SecurityPlatform {
  requestPermission(
    request: PermissionRequest
  ): Promise<PermissionResult>;

  setPermission(
    origin: string,
    permission: SecurityPermission,
    decision: PermissionDecision
  ): Promise<void>;

  getPermission(
    origin: string,
    permission: SecurityPermission
  ): Promise<PermissionDecision>;

  clearPermissions(
    origin?: string
  ): Promise<void>;

  setPolicy(
    policy: SecurityPolicy
  ): Promise<void>;

  getPolicy(): Promise<SecurityPolicy>;

  validateNavigation(
    url: string,
    origin?: string
  ): Promise<boolean>;

  validateExternalProtocol(
    url: string
  ): Promise<boolean>;

  getSecurityAuditLog(
    limit?: number
  ): Promise<readonly SecurityAuditEvent[]>;

  clearSecurityAuditLog(): Promise<void>;

  shutdown(): Promise<void>;
}