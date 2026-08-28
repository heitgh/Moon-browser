import type { IpcMainInvokeEvent } from "electron";
import type { BrowserApplicationApi } from "../../application/browser-application-service.js";
import type { WindowManager } from "../main/window-manager.js";
import type { IpcRouter } from "./ipc-router.js";
import { parseSitePermissionKey } from "../../../../packages/ipc/site-permission-contract.js";

interface TabPayload { readonly tabId: string; }
interface NavigatePayload extends TabPayload { readonly url: string; }
interface BoundsPayload { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
interface CreateTabPayload { readonly url?: string; readonly workspaceId?: string; }

export function registerBrowserIpc(
  router: IpcRouter,
  browser: BrowserApplicationApi,
  windows: WindowManager,
  createPrivateWindow: () => Promise<void>
): void {
  const windowIdFor = (event: IpcMainInvokeEvent): string => {
    const windowId = windows.idForWebContents(event.sender);
    if (!windowId) throw new Error("Browser window is not registered");
    return windowId;
  };

  const ownedTab = (event: IpcMainInvokeEvent, payload: TabPayload): string => {
    if (!payload || typeof payload.tabId !== "string") throw new TypeError("A tabId is required");
    const windowId = windowIdFor(event);
    if (!browser.ownsTab(payload.tabId, windowId)) throw new Error("Tab does not belong to this window");
    return payload.tabId;
  };

  router.register("browser:create-tab", (event, payload?: CreateTabPayload) => {
    const url = payload?.url;
    const workspaceId = payload?.workspaceId;
    if (url !== undefined && typeof url !== "string") throw new TypeError("Invalid URL");
    if (
      workspaceId !== undefined &&
      (typeof workspaceId !== "string" || workspaceId.length > 80)
    ) {
      throw new TypeError("Invalid workspace ID");
    }
    const windowId = windowIdFor(event);
    const privateMode = windows.isPrivate(windowId);
    return browser.createTab(windowId, { url, workspaceId, active: true, private: privateMode, ...(privateMode ? { sessionId: windowId } : {}) });
  });
  router.register("browser:get-window-context", event => { const windowId = windowIdFor(event); return { private: windows.isPrivate(windowId) }; });
  router.register("browser:create-private-window", async event => { windowIdFor(event); await createPrivateWindow(); });
  router.register("browser:get-tabs", event => browser.getTabs(windowIdFor(event)));
  router.register("browser:close-tab", (event, payload: TabPayload) => browser.closeTab(ownedTab(event, payload)));
  router.register("browser:activate-tab", (event, payload: TabPayload) => browser.activateTab(ownedTab(event, payload)));
  router.register("browser:show-home", (event, payload: TabPayload) => browser.showHome(ownedTab(event, payload)));
  router.register("browser:show-internal-page", (event, payload: NavigatePayload) => {
    const tabId = ownedTab(event, payload); if (typeof payload.url !== "string" || payload.url.length > 200) throw new TypeError("Invalid internal URL"); return browser.showInternalPage(tabId, payload.url);
  });
  router.register("browser:navigate", (event, payload: NavigatePayload) => {
    const tabId = ownedTab(event, payload);
    if (typeof payload.url !== "string" || payload.url.length > 16_384) throw new TypeError("Invalid URL");
    return browser.navigate(tabId, payload.url);
  });
  router.register("browser:back", (event, payload: TabPayload) => browser.goBack(ownedTab(event, payload)));
  router.register("browser:forward", (event, payload: TabPayload) => browser.goForward(ownedTab(event, payload)));
  router.register("browser:reload", (event, payload: TabPayload & { readonly bypassCache?: boolean }) =>
    browser.reload(ownedTab(event, payload), payload.bypassCache === true));
  router.register("browser:stop", (event, payload: TabPayload) => browser.stopLoading(ownedTab(event, payload)));
  router.register("browser:set-bounds", (event, payload: BoundsPayload) => {
    if (!payload || ![payload.x, payload.y, payload.width, payload.height].every(Number.isFinite)) {
      throw new TypeError("Invalid browser bounds");
    }
    browser.setBounds(windowIdFor(event), payload);
  });
  router.register("browser:set-content-visible", (event, payload?: { readonly visible?: boolean }) => {
    if (!payload || typeof payload.visible !== "boolean") {
      throw new TypeError("A visibility value is required");
    }
    browser.setContentVisible(windowIdFor(event), payload.visible);
  });
  router.register("browser:set-search-template", (event, payload?: { readonly template?: string }) => {
    if (!payload || typeof payload.template !== "string") throw new TypeError("A search template is required");
    browser.setSearchTemplate(windowIdFor(event), payload.template);
  });
  router.register("browser:respond-permission", (event, payload?: { readonly requestId?: string; readonly granted?: boolean }) => {
    if (!payload || typeof payload.requestId !== "string" || typeof payload.granted !== "boolean") {
      throw new TypeError("A valid permission response is required");
    }
    return browser.respondToPermission(windowIdFor(event), payload.requestId, payload.granted);
  });
  router.register("browser:list-site-permissions", event => windows.isPrivate(windowIdFor(event)) ? [] : browser.listPermissions());
  router.register("browser:clear-site-permission", (event, payload: unknown) => {
    if (windows.isPrivate(windowIdFor(event))) throw new Error("Private windows cannot change persistent site permissions");
    const key = parseSitePermissionKey(payload); return browser.clearPermission(key.origin, key.permission);
  });
}
