import type { Platform } from "@moon/platform";
import { BrowserError } from "../errors/browser-error.js";
import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { NavigationRequest, NavigationResult } from "./navigation.js";

export class NavigationManager {
  #nextId = 0;

  constructor(
    readonly platform: Platform,
    readonly eventBus: MoonEventBus = moonEventBus
  ) {}

  async navigate(
    tabId: string,
    url: string,
    options: Partial<Omit<NavigationRequest, "id" | "tabId" | "url" | "timestamp">> = {}
  ): Promise<NavigationResult> {
    const request: NavigationRequest = {
      id: `navigation-${++this.#nextId}`,
      tabId,
      url: this.normalizeUrl(url),
      disposition: options.disposition ?? "current-tab",
      userInitiated: options.userInitiated ?? true,
      referrerUrl: options.referrerUrl,
      replace: options.replace,
      bypassCache: options.bypassCache,
      timestamp: Date.now()
    };
    const startedAt = Date.now();

    await this.eventBus.publish("navigation:started", { request }, {
      context: { tabId }, source: { type: "core", id: "navigation-manager" }
    });

    try {
      await this.platform.browser.navigate(tabId, request.url, {
        replace: request.replace,
        userInitiated: request.userInitiated,
        bypassCache: request.bypassCache
      });
      const result: NavigationResult = {
        request, status: "completed", finalUrl: request.url,
        startedAt, completedAt: Date.now()
      };
      await this.eventBus.publish("navigation:completed", { result }, {
        context: { tabId }, source: { type: "core", id: "navigation-manager" }
      });
      return result;
    } catch (error) {
      const result: NavigationResult = {
        request, status: "failed", error, startedAt, completedAt: Date.now()
      };
      await this.eventBus.publish("navigation:failed", { result }, {
        context: { tabId }, source: { type: "core", id: "navigation-manager" }
      });
      throw new BrowserError("NAVIGATION_FAILED", `Navigation failed: ${request.url}`, {
        tabId, url: request.url, cause: error, recoverable: true
      });
    }
  }

  goBack(tabId: string): Promise<void> { return this.platform.browser.goBack(tabId); }
  goForward(tabId: string): Promise<void> { return this.platform.browser.goForward(tabId); }
  reload(tabId: string, bypassCache = false): Promise<void> {
    return this.platform.browser.reload(tabId, bypassCache);
  }
  stop(tabId: string): Promise<void> { return this.platform.browser.stopLoading(tabId); }

  normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new BrowserError("NAVIGATION_BLOCKED", "Navigation URL is empty", { recoverable: true });
    try { return new URL(trimmed).toString(); }
    catch { return new URL(`https://${trimmed}`).toString(); }
  }
}
