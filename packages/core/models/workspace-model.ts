export type WorkspaceLayout = "standard" | "compact" | "focus";

export interface WorkspaceAppearance {
  readonly color?: string;
  readonly icon?: string;
  readonly wallpaperUrl?: string;
  readonly themeId?: string;
}

export interface WorkspaceModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly position: number;
  readonly layout: WorkspaceLayout;
  readonly appearance: WorkspaceAppearance;
  readonly default: boolean;
  readonly archived: boolean;
  readonly activeSessionId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastAccessedAt: number;
}

export interface CreateWorkspaceInput {
  readonly name: string;
  readonly description?: string;
  readonly layout?: WorkspaceLayout;
  readonly appearance?: WorkspaceAppearance;
}

export type UpdateWorkspaceInput = Partial<
  Omit<
    WorkspaceModel,
    "id" | "default" | "createdAt" | "updatedAt" | "lastAccessedAt"
  >
>;
