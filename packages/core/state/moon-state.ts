import type { BookmarkModel } from "../models/bookmark-model.js";
import type { HistoryModel } from "../models/history-model.js";
import type { NoteModel } from "../models/note-model.js";
import type { SessionModel } from "../models/session-model.js";
import type { TabModel } from "../models/tab-model.js";
import type { WorkspaceModel } from "../models/workspace-model.js";

export interface MoonState {
  readonly version: number;
  readonly initialized: boolean;
  readonly activeWindowId?: string;
  readonly activeTabId?: string;
  readonly activeWorkspaceId?: string;
  readonly activeSessionId?: string;
  readonly tabs: Readonly<Record<string, TabModel>>;
  readonly workspaces: Readonly<Record<string, WorkspaceModel>>;
  readonly sessions: Readonly<Record<string, SessionModel>>;
  readonly bookmarks: Readonly<Record<string, BookmarkModel>>;
  readonly history: Readonly<Record<string, HistoryModel>>;
  readonly notes: Readonly<Record<string, NoteModel>>;
  readonly updatedAt: number;
}

export function createInitialMoonState(
  overrides: Partial<MoonState> = {}
): MoonState {
  return {
    version: 1,
    initialized: false,
    tabs: {},
    workspaces: {},
    sessions: {},
    bookmarks: {},
    history: {},
    notes: {},
    updatedAt: Date.now(),
    ...overrides
  };
}
