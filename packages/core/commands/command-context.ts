import type { Platform } from "@moon/platform";
import type { MoonEventBus } from "../events/event-bus.js";
import type { MoonStateStore } from "../state/state-store.js";

export interface CommandContext {
  readonly platform: Platform;
  readonly eventBus: MoonEventBus;
  readonly stateStore: MoonStateStore;
  readonly windowId?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateCommandContextOptions {
  readonly platform: Platform;
  readonly eventBus: MoonEventBus;
  readonly stateStore: MoonStateStore;
  readonly windowId?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createCommandContext(
  options: CreateCommandContextOptions
): CommandContext {
  return { ...options };
}
