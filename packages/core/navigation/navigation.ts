export type NavigationDisposition =
  | "current-tab"
  | "new-foreground-tab"
  | "new-background-tab"
  | "new-window"
  | "external";

export type NavigationStatus =
  | "pending"
  | "allowed"
  | "blocked"
  | "committed"
  | "completed"
  | "failed"
  | "cancelled";

export interface NavigationRequest {
  readonly id: string;
  readonly tabId: string;
  readonly url: string;
  readonly referrerUrl?: string;
  readonly disposition: NavigationDisposition;
  readonly userInitiated: boolean;
  readonly replace?: boolean;
  readonly bypassCache?: boolean;
  readonly timestamp: number;
}

export interface NavigationEntry {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly index: number;
  readonly timestamp: number;
}

export interface NavigationResult {
  readonly request: NavigationRequest;
  readonly status: NavigationStatus;
  readonly finalUrl?: string;
  readonly error?: unknown;
  readonly startedAt: number;
  readonly completedAt?: number;
}
