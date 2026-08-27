export type SessionStatus = "active" | "suspended" | "closed";

export interface SessionTabSnapshot {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly position: number;
  readonly pinned: boolean;
  readonly muted: boolean;
  readonly groupId?: string;
}

export interface SessionModel {
  readonly id: string;
  readonly name: string;
  readonly status: SessionStatus;
  readonly workspaceId?: string;
  readonly activeTabId?: string;
  readonly tabs: readonly SessionTabSnapshot[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly suspendedAt?: number;
  readonly closedAt?: number;
}

export type CreateSessionInput = Pick<
  SessionModel,
  "name" | "workspaceId"
>;
