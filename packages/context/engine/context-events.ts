import type { MoonEvent } from "@moon/core"; import type { ContextRequest, ContextSnapshot } from "./context-engine.js";
export type ContextBuildStartedEvent = MoonEvent<"context:build-started", { readonly request: ContextRequest }>;
export type ContextBuiltEvent = MoonEvent<"context:built", { readonly request: ContextRequest; readonly snapshot: ContextSnapshot }>;
export type ContextClearedEvent = MoonEvent<"context:cleared", { readonly scope: "all" | "workspace" | "session" | "tab"; readonly id?: string }>;
