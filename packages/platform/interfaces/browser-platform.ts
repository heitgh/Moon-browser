export interface BrowserTabOptions {
  readonly id?: string;
  readonly url?: string;
  readonly active?: boolean;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly private?: boolean;
}

export interface BrowserTab {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly active: boolean;
  readonly loading: boolean;
  readonly faviconUrl?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly private: boolean;
}

export interface BrowserWindowOptions {
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly title?: string;
  readonly resizable?: boolean;
  readonly fullscreen?: boolean;
}

export interface BrowserNavigationOptions {
  readonly replace?: boolean;
  readonly userInitiated?: boolean;
  readonly bypassCache?: boolean;
}

export interface BrowserPlatform {
  createWindow(options?: BrowserWindowOptions): Promise<string>;

  closeWindow(windowId: string): Promise<void>;

  focusWindow(windowId: string): Promise<void>;

  createTab(
    windowId: string,
    options?: BrowserTabOptions
  ): Promise<BrowserTab>;

  closeTab(tabId: string): Promise<void>;

  activateTab(tabId: string): Promise<void>;

  navigate(
    tabId: string,
    url: string,
    options?: BrowserNavigationOptions
  ): Promise<void>;

  goBack(tabId: string): Promise<void>;

  goForward(tabId: string): Promise<void>;

  reload(
    tabId: string,
    bypassCache?: boolean
  ): Promise<void>;

  stopLoading(tabId: string): Promise<void>;

  getTab(tabId: string): Promise<BrowserTab | null>;

  getTabs(windowId: string): Promise<readonly BrowserTab[]>;

  executeScript(
    tabId: string,
    script: string
  ): Promise<unknown>;

  capturePage(
    tabId: string
  ): Promise<Uint8Array>;

  destroy(): Promise<void>;
}
