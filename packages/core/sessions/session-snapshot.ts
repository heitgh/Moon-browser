import type { SessionTabSnapshot } from "../models/session-model.js";
import type { TabModel } from "../models/tab-model.js";

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly workspaceId?: string;
  readonly activeTabId?: string;
  readonly tabs: readonly SessionTabSnapshot[];
  readonly capturedAt: number;
}

export function createSessionSnapshot(
  sessionId: string,
  tabs: readonly TabModel[],
  activeTabId?: string,
  workspaceId?: string
): SessionSnapshot {
  return {
    sessionId, workspaceId, activeTabId, capturedAt: Date.now(),
    tabs: tabs.map(tab => ({
      id: tab.id, url: tab.url, title: tab.title, position: tab.position,
      pinned: tab.pinned, muted: tab.muted, groupId: tab.groupId
    }))
  };
}
