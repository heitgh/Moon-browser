import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ contents: undefined as unknown }));
vi.mock("electron", () => ({ WebContentsView: class {
  webContents = fixture.contents;
  setVisible() {}
} }));
import { ElectronBrowserSurface } from "../../apps/desktop/electron/browser/browser-surface.js";

it("waits for actual WebContents destruction before reporting teardown complete", async () => {
  const contents = Object.assign(new EventEmitter(), { isDestroyed: () => false, close: vi.fn() });
  fixture.contents = contents;
  const host = { isDestroyed: () => false, contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } };
  const surface = new ElectronBrowserSurface("surface", "tab", host as never);
  let finished = false;
  const closing = surface.destroy();
  void closing.then(() => { finished = true; });
  expect(surface.destroy()).toBe(closing);
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(contents.close).toHaveBeenCalledExactlyOnceWith({waitForBeforeUnload: false});
  expect(host.contentView.removeChildView).toHaveBeenCalledTimes(1);
  contents.emit("destroyed");
  await closing;
  expect(finished).toBe(true);
});
