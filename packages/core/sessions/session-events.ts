import type { MoonEvent } from "../events/event-types.js";
import type { SessionModel } from "../models/session-model.js";

export type SessionCreatedEvent = MoonEvent<"session:created", { readonly session: SessionModel }>;
export type SessionUpdatedEvent = MoonEvent<"session:updated", { readonly session: SessionModel; readonly previousSession: SessionModel }>;
export type SessionActivatedEvent = MoonEvent<"session:activated", { readonly session: SessionModel; readonly previousSessionId?: string }>;
export type SessionClosedEvent = MoonEvent<"session:closed", { readonly session: SessionModel }>;
