import { clipboard, Menu, type BrowserWindow, type ContextMenuParams, type MenuItemConstructorOptions, type WebContents } from "electron";
import { buildContextMenu, type ContextMenuAction } from "./context-menu-model.js";

export interface ContextMenuTab { readonly id: string; readonly workspaceId?: string; readonly sessionId?: string; readonly private: boolean; }
export interface ElectronContextMenuOptions { readonly windowId: string; readonly window: BrowserWindow; readonly contents: WebContents; readonly params: ContextMenuParams; readonly tab: ContextMenuTab; readonly searchUrl: (selection: string) => string; readonly createTab: (url: string, tab: ContextMenuTab) => Promise<unknown>; readonly navigate: (tabId: string, url: string) => Promise<void>; }

export function openElectronContextMenu(options: ElectronContextMenuOptions): void {
  const { contents, params } = options;
  const kind = params.isEditable ? "editable" : params.mediaType === "image" ? "image" : ["audio", "video"].includes(params.mediaType) ? "media" : params.linkURL ? "link" : params.selectionText.trim() ? "selection" : "page";
  const model = buildContextMenu({ tabId: options.tab.id, windowId: options.windowId, kind, pageURL: params.pageURL, frameURL: params.frameURL, linkURL: params.linkURL, srcURL: params.srcURL, mediaType: params.mediaType, hasImageContents: params.hasImageContents, isEditable: params.isEditable, selectionText: params.selectionText, canGoBack: contents.navigationHistory.canGoBack(), canGoForward: contents.navigationHistory.canGoForward(), editFlags: params.editFlags });
  const template: MenuItemConstructorOptions[] = model.map(entry => {
    if (entry.kind === "separator") return { type: "separator" };
    if (entry.kind === "role") return { role: entry.role, enabled: entry.enabled };
    return { label: entry.label, enabled: entry.enabled !== false, click: () => void execute(entry.id!, options).catch(error => console.error("Context menu action failed", error)) };
  });
  Menu.buildFromTemplate(template).popup({ window: options.window });
}

async function execute(action: ContextMenuAction, options: ElectronContextMenuOptions): Promise<void> {
  const { contents, params, tab } = options; if (contents.isDestroyed()) return;
  if (action === "back") { if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack(); return; }
  if (action === "forward") { if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward(); return; }
  if (action === "reload") { contents.reload(); return; }
  if (action === "copy-selection") { clipboard.writeText(params.selectionText); return; }
  if (action === "search-selection") { await options.createTab(options.searchUrl(params.selectionText.trim().slice(0, 2_000)), tab); return; }
  if (action === "copy-image") { contents.copyImageAt(params.x, params.y); return; }
  if (action === "copy-page-url") { clipboard.writeText(safeWebUrl(params.pageURL)); return; }
  if (action === "open-page-new-tab") { await options.createTab(safeWebUrl(params.pageURL), tab); return; }
  if (action === "save-page") { contents.downloadURL(safeWebUrl(params.pageURL)); return; }
  if (action === "print") { await new Promise<void>((resolve, reject) => contents.print({ printBackground: true }, (success, reason) => success ? resolve() : reject(new Error(reason)))); return; }
  const url = action === "open-link" || action === "open-link-new-tab" || action === "copy-link" || action === "save-link" ? safeWebUrl(params.linkURL) : safeWebUrl(params.srcURL);
  if (action === "copy-link" || action === "copy-media-url") { clipboard.writeText(url); return; }
  if (action === "open-link") { await options.navigate(tab.id, url); return; }
  if (action === "open-link-new-tab" || action === "open-media-new-tab") { await options.createTab(url, tab); return; }
  if (action === "save-link" || action === "save-media") contents.downloadURL(url);
}

function safeWebUrl(value: string): string { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("URL não permitida no menu contextual."); return url.href; }
