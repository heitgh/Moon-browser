import type { WorkspaceModel } from "../models/workspace-model.js";

export interface WorkspaceState {
  readonly workspaces: Readonly<Record<string, WorkspaceModel>>;
  readonly activeWorkspaceId?: string;
}
export function createWorkspaceState(workspaces: readonly WorkspaceModel[] = []): WorkspaceState {
  const ordered = [...workspaces].sort((a, b) => a.position - b.position);
  return { workspaces: Object.fromEntries(ordered.map(item => [item.id, item])), activeWorkspaceId: ordered.find(item => item.default)?.id };
}
