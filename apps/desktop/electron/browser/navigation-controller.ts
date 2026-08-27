import type { WebContents } from "electron";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class NavigationController {
  constructor(readonly contents: WebContents) {}

  async navigate(value: string): Promise<void> {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      throw new Error(`Navigation protocol is not allowed: ${url.protocol}`);
    }
    await this.contents.loadURL(url.toString());
  }

  back(): void {
    if (this.contents.navigationHistory.canGoBack()) this.contents.navigationHistory.goBack();
  }

  forward(): void {
    if (this.contents.navigationHistory.canGoForward()) this.contents.navigationHistory.goForward();
  }

  reload(bypassCache = false): void {
    if (bypassCache) this.contents.reloadIgnoringCache();
    else this.contents.reload();
  }

  stop(): void { this.contents.stop(); }
}
