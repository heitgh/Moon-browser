export type TabLoadingState = "idle" | "loading" | "complete" | "failed";

export interface TabModel {
  readonly id: string;
  readonly windowId: string;
  readonly url: string;
  readonly title: string;
  readonly faviconUrl?: string;
  readonly position: number;
  readonly active: boolean;
  readonly pinned: boolean;
  readonly muted: boolean;
  readonly audible: boolean;
  readonly discarded: boolean;
  readonly private: boolean;
  readonly loadingState: TabLoadingState;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly groupId?: string;
  readonly openerTabId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastAccessedAt: number;
}

export interface CreateTabInput {
  readonly id?: string;
  readonly windowId: string;
  readonly url?: string;
  readonly active?: boolean;
  readonly pinned?: boolean;
  readonly private?: boolean;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly groupId?: string;
  readonly openerTabId?: string;
}
