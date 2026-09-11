export type HistoryTransition =
  | "link"
  | "typed"
  | "auto-bookmark"
  | "auto-subframe"
  | "manual-subframe"
  | "generated"
  | "reload"
  | "form-submit"
  | "keyword";

export interface HistoryModel {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly faviconUrl?: string;
  readonly transition: HistoryTransition;
  readonly visitCount: number;
  readonly typedCount: number;
  readonly firstVisitedAt: number;
  readonly lastVisitedAt: number;
  readonly endedAt?: number;
  readonly durationMs?: number;
  readonly profileId?: string;
  readonly source?: "navigation" | "import" | "legacy";
  readonly navigationType?: "link" | "typed" | "reload" | "redirect" | "form-submit" | "history" | "generated" | "other";
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
}

export interface HistoryVisitModel {
  readonly id: string;
  readonly historyId: string;
  readonly visitedAt: number;
  readonly transition: HistoryTransition;
  readonly referrerUrl?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
}
