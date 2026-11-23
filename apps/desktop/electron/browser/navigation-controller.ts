import type { WebContents } from "electron";
import { isWebNavigation } from "../security/web-preferences.js";

export class NavigationController {
  constructor(readonly contents: WebContents) {}

  async navigate(value: string): Promise<void> {
    if (!isWebNavigation(value)) throw new Error("Navigation URL is not allowed");
    const url = new URL(value);
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
