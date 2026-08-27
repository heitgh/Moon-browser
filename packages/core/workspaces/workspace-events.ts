import type { MoonEvent } from "../events/event-types.js";
import type { WorkspaceModel } from "../models/workspace-model.js";
export type WorkspaceCreatedEvent = MoonEvent<"workspace:created", { readonly workspace: WorkspaceModel }>;
export type WorkspaceUpdatedEvent = MoonEvent<"workspace:updated", { readonly workspace: WorkspaceModel; readonly previousWorkspace: WorkspaceModel }>;
export type WorkspaceActivatedEvent = MoonEvent<"workspace:activated", { readonly workspace: WorkspaceModel; readonly previousWorkspaceId?: string }>;
export type WorkspaceArchivedEvent = MoonEvent<"workspace:archived", { readonly workspace: WorkspaceModel }>;
