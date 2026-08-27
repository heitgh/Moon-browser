import { describe, expect, it } from "vitest";
import { buildContextMenu, type ContextMenuInput } from "../../apps/desktop/electron/browser/context-menu-model.js";

const base: ContextMenuInput = { tabId: "tab-1", windowId: "window-1", kind: "page", pageURL: "https://example.com/", frameURL: "https://example.com/", linkURL: "", srcURL: "", mediaType: "none", hasImageContents: false, isEditable: false, selectionText: "", canGoBack: true, canGoForward: false, editFlags: { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: false, canSelectAll: true } };
const ids = (input: ContextMenuInput) => buildContextMenu(input).flatMap(entry => entry.id ? [entry.id] : []);

describe("native context-menu model", () => {
  it("offers page navigation, safe URL, saving and printing without renderer capabilities", () => { expect(ids(base)).toEqual(["back", "forward", "reload", "copy-page-url", "open-page-new-tab", "save-page", "print"]); });
  it("prioritizes native image copy, URL copy and managed saving", () => { expect(ids({ ...base, kind: "image", srcURL: "https://cdn.example/image.png", mediaType: "image", hasImageContents: true })).toEqual(["copy-image", "copy-media-url", "open-media-new-tab", "save-media", "back", "forward", "reload", "copy-page-url", "open-page-new-tab", "save-page", "print"]); });
  it("offers safe link actions and rejects script schemes", () => { expect(ids({ ...base, linkURL: "https://example.com/path" })).toContain("save-link"); expect(ids({ ...base, linkURL: "javascript:alert(1)" })).not.toContain("open-link"); });
  it("uses native edit roles for editable fields", () => { const entries = buildContextMenu({ ...base, isEditable: true }); expect(entries.filter(entry => entry.kind === "role").map(entry => entry.role)).toEqual(["undo", "redo", "cut", "copy", "paste", "selectAll"]); });
});
