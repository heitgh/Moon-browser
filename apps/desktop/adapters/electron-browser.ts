import type { BrowserNavigationOptions, BrowserPlatform, BrowserTab, BrowserTabOptions, BrowserWindowOptions } from "@moon/platform";
export interface ElectronBrowserBackend {
  createWindow(options?: BrowserWindowOptions): Promise<string>;
  closeWindow(id: string): Promise<void>; focusWindow(id: string): Promise<void>;
  createTab(windowId: string, options?: BrowserTabOptions): Promise<BrowserTab>;
  closeTab(id: string): Promise<void>; activateTab(id: string): Promise<void>;
  navigate(id: string, url: string, options?: BrowserNavigationOptions): Promise<void>;
  goBack(id: string): Promise<void>; goForward(id: string): Promise<void>; reload(id: string, bypassCache?: boolean): Promise<void>; stopLoading(id: string): Promise<void>;
  getTab(id: string): Promise<BrowserTab | null>; getTabs(windowId: string): Promise<readonly BrowserTab[]>;
  executeScript(id: string, script: string): Promise<unknown>; capturePage(id: string): Promise<Uint8Array>; destroy(): Promise<void>;
}
export class ElectronBrowserPlatform implements BrowserPlatform {
  constructor(readonly backend: ElectronBrowserBackend) {}
  createWindow(options?: BrowserWindowOptions) { return this.backend.createWindow(options); } closeWindow(id: string) { return this.backend.closeWindow(id); } focusWindow(id: string) { return this.backend.focusWindow(id); }
  createTab(windowId: string, options?: BrowserTabOptions) { return this.backend.createTab(windowId, options); } closeTab(id: string) { return this.backend.closeTab(id); } activateTab(id: string) { return this.backend.activateTab(id); }
  navigate(id: string, url: string, options?: BrowserNavigationOptions) { return this.backend.navigate(id, url, options); } goBack(id: string) { return this.backend.goBack(id); } goForward(id: string) { return this.backend.goForward(id); } reload(id: string, bypassCache?: boolean) { return this.backend.reload(id, bypassCache); } stopLoading(id: string) { return this.backend.stopLoading(id); }
  getTab(id: string) { return this.backend.getTab(id); } getTabs(windowId: string) { return this.backend.getTabs(windowId); } executeScript(id: string, script: string) { return this.backend.executeScript(id, script); } capturePage(id: string) { return this.backend.capturePage(id); } destroy() { return this.backend.destroy(); }
}
