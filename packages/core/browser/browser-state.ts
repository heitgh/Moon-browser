import type { BrowserModel } from "./browser.js";
export function createBrowserState(): BrowserModel { return { lifecycle: "created", windows: {} }; }
export function activeBrowserWindow(state: BrowserModel) { return state.activeWindowId ? state.windows[state.activeWindowId] : undefined; }
