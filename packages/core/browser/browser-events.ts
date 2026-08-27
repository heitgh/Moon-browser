import type { MoonEvent } from "../events/event-types.js";
import type { BrowserLifecycleState, BrowserWindowModel } from "./browser.js";
export type BrowserLifecycleEvent = MoonEvent<"browser:lifecycle", { readonly state: BrowserLifecycleState; readonly previousState: BrowserLifecycleState }>;
export type BrowserWindowCreatedEvent = MoonEvent<"browser:window-created", { readonly window: BrowserWindowModel }>;
export type BrowserWindowClosedEvent = MoonEvent<"browser:window-closed", { readonly windowId: string }>;
