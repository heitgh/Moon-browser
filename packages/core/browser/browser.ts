export type BrowserLifecycleState = "created" | "initializing" | "ready" | "shutting-down" | "destroyed";
export interface BrowserWindowModel { readonly id: string; readonly active: boolean; readonly focused: boolean; readonly createdAt: number; }
export interface BrowserModel { readonly lifecycle: BrowserLifecycleState; readonly windows: Readonly<Record<string, BrowserWindowModel>>; readonly activeWindowId?: string; }
