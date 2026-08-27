import type { MoonEvent } from "../events/event-types.js";
import type { NavigationRequest, NavigationResult } from "./navigation.js";

export type NavigationStartedEvent = MoonEvent<"navigation:started", {
  readonly request: NavigationRequest;
}>;

export type NavigationCommittedEvent = MoonEvent<"navigation:committed", {
  readonly result: NavigationResult;
}>;

export type NavigationCompletedEvent = MoonEvent<"navigation:completed", {
  readonly result: NavigationResult;
}>;

export type NavigationFailedEvent = MoonEvent<"navigation:failed", {
  readonly result: NavigationResult;
}>;
