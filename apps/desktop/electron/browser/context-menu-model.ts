export type MoonContextKind = "page" | "link" | "image" | "media" | "selection" | "editable";
export type ContextMenuAction = "back" | "forward" | "reload" | "copy-page-url" | "open-page-new-tab" | "save-page" | "print" | "open-link" | "open-link-new-tab" | "copy-link" | "save-link" | "copy-selection" | "search-selection" | "copy-image" | "copy-media-url" | "open-media-new-tab" | "save-media";
export interface ContextMenuInput { readonly tabId: string; readonly windowId: string; readonly kind: MoonContextKind; readonly pageURL: string; readonly frameURL: string; readonly linkURL: string; readonly srcURL: string; readonly mediaType: "none" | "image" | "audio" | "video" | "canvas" | "file" | "plugin"; readonly hasImageContents: boolean; readonly isEditable: boolean; readonly selectionText: string; readonly canGoBack: boolean; readonly canGoForward: boolean; readonly editFlags: { readonly canUndo: boolean; readonly canRedo: boolean; readonly canCut: boolean; readonly canCopy: boolean; readonly canPaste: boolean; readonly canSelectAll: boolean }; }
export interface ContextMenuEntry { readonly kind: "action" | "role" | "separator"; readonly id?: ContextMenuAction; readonly role?: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"; readonly label?: string; readonly enabled?: boolean; }

function webUrl(value: string): boolean { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } }
function separator(entries: ContextMenuEntry[]): void { if (entries.length && entries.at(-1)?.kind !== "separator") entries.push({ kind: "separator" }); }

export function buildContextMenu(input: ContextMenuInput): readonly ContextMenuEntry[] {
  const entries: ContextMenuEntry[] = [];
  if (input.isEditable) {
    entries.push({ kind: "role", role: "undo", enabled: input.editFlags.canUndo }, { kind: "role", role: "redo", enabled: input.editFlags.canRedo }, { kind: "separator" }, { kind: "role", role: "cut", enabled: input.editFlags.canCut }, { kind: "role", role: "copy", enabled: input.editFlags.canCopy }, { kind: "role", role: "paste", enabled: input.editFlags.canPaste }, { kind: "role", role: "selectAll", enabled: input.editFlags.canSelectAll });
  } else if (input.selectionText.trim()) {
    entries.push({ kind: "action", id: "copy-selection", label: "Copiar" }, { kind: "action", id: "search-selection", label: "Pesquisar seleção em nova guia" });
  }
  if (webUrl(input.linkURL)) { separator(entries); entries.push({ kind: "action", id: "open-link", label: "Abrir link" }, { kind: "action", id: "open-link-new-tab", label: "Abrir link em nova guia" }, { kind: "action", id: "copy-link", label: "Copiar endereço do link" }, { kind: "action", id: "save-link", label: "Salvar link como…" }); }
  if (webUrl(input.srcURL) && input.mediaType === "image") { separator(entries); if (input.hasImageContents) entries.push({ kind: "action", id: "copy-image", label: "Copiar imagem" }); entries.push({ kind: "action", id: "copy-media-url", label: "Copiar endereço da imagem" }, { kind: "action", id: "open-media-new-tab", label: "Abrir imagem em nova guia" }, { kind: "action", id: "save-media", label: "Salvar imagem como…" }); }
  if (webUrl(input.srcURL) && ["audio", "video"].includes(input.mediaType)) { separator(entries); entries.push({ kind: "action", id: "copy-media-url", label: "Copiar endereço da mídia" }, { kind: "action", id: "open-media-new-tab", label: "Abrir mídia em nova guia" }, { kind: "action", id: "save-media", label: "Salvar mídia como…" }); }
  separator(entries); entries.push({ kind: "action", id: "back", label: "Voltar", enabled: input.canGoBack }, { kind: "action", id: "forward", label: "Avançar", enabled: input.canGoForward }, { kind: "action", id: "reload", label: "Recarregar" });
  if (webUrl(input.pageURL)) entries.push({ kind: "action", id: "copy-page-url", label: "Copiar endereço da página" }, { kind: "action", id: "open-page-new-tab", label: "Abrir página em nova guia" }, { kind: "action", id: "save-page", label: "Salvar página como…" }, { kind: "action", id: "print", label: "Imprimir…" });
  return entries;
}
