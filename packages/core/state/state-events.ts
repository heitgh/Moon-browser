import type { MoonEvent } from "../events/event-types.js";
import type { MoonState } from "./moon-state.js";

export type MoonStateChangeReason =
  | "initialize"
  | "hydrate"
  | "user-action"
  | "navigation"
  | "synchronization"
  | "system"
  | "reset";

export interface MoonStateChangedPayload {
  readonly previousState: MoonState;
  readonly state: MoonState;
  readonly reason: MoonStateChangeReason;
  readonly changedKeys: readonly (keyof MoonState)[];
}

export type MoonStateChangedEvent = MoonEvent<
  "state:changed",
  MoonStateChangedPayload
>;

export interface MoonStateHydratedPayload {
  readonly state: MoonState;
  readonly source: "storage" | "sync" | "migration";
}

export type MoonStateHydratedEvent = MoonEvent<
  "state:hydrated",
  MoonStateHydratedPayload
>;
