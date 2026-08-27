import type { SessionModel } from "../models/session-model.js";

export interface SessionState {
  readonly sessions: Readonly<Record<string, SessionModel>>;
  readonly activeSessionId?: string;
}

export function createSessionState(sessions: readonly SessionModel[] = []): SessionState {
  return {
    sessions: Object.fromEntries(sessions.map(session => [session.id, session])),
    activeSessionId: sessions.find(session => session.status === "active")?.id
  };
}
