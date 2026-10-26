// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { DownloadShelf } from "../../ui/downloads/download-shelf.js";
import type { ManagedDownload } from "../../ui/browser-shell/contracts.js";
const item: ManagedDownload = { id: "file", filename: "<script>file</script>", url: "https://example.com/file", savePath: "", state: "in-progress", receivedBytes: 500, totalBytes: 1000, percentage: 50, speedBytesPerSecond: 100, startedAt: 0 };
it("shows live progress safely and controls the actual download", () => {
  const actions = { open: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn() }; const shelf = new DownloadShelf(actions);
  shelf.render([]); expect(shelf.element.hidden).toBe(true);
  shelf.render([item]); expect(shelf.element.hidden).toBe(false); expect(shelf.element.querySelector("script")).toBeNull();
  expect(shelf.element.querySelector("progress")!.value).toBe(50);
  shelf.element.querySelector<HTMLButtonElement>("[aria-label^='Pausar']")!.click(); expect(actions.pause).toHaveBeenCalledWith("file");
  shelf.render([{ ...item, percentage: null, totalBytes: 0 }]); expect(shelf.element.querySelector("progress")!.hasAttribute("value")).toBe(false);
  shelf.render([{ ...item, state: "completed", percentage: 100 }]); expect(shelf.element.textContent).toContain("Concluído");
  shelf.element.querySelector<HTMLButtonElement>("[aria-label^='Dispensar']")!.click(); expect(shelf.element.hidden).toBe(true);
});
