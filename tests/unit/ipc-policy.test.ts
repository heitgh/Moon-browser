import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assertBoundedPayload, assertShellCaller } from "../../apps/desktop/electron/ipc/ipc-policy.js";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
function fixture() {
  const frame = { url: pathToFileURL(join(resolve("/moon"), "index.html")).href, detached: false };
  const sender = { isDestroyed: () => false, mainFrame: frame, getURL: () => frame.url };
  const window = { webContents: sender, isDestroyed: () => false };
  const windows = { idForWebContents: () => "registered", get: () => window };
  const event = { sender, senderFrame: frame } as unknown as Electron.IpcMainInvokeEvent;
  return { frame, sender, window, windows: windows as unknown as WindowManager, event };
}
describe("privileged IPC boundary", () => {
  it("accepts only the registered shell document", () => { const h = fixture(); expect(() => assertShellCaller(h.event, h.windows, "/moon")).not.toThrow(); });
  it.each(["https://evil.test/", "file:///moon/other.html", "file:///moon/index.html?remote=1", "about:blank"])("rejects document %s before side effects", url => {
    const h = fixture(); h.frame.url = url; const command = vi.fn();
    expect(() => { assertShellCaller(h.event, h.windows, "/moon"); command(); }).toThrow(); expect(command).not.toHaveBeenCalled();
  });
  it("rejects an iframe even with the shell URL", () => { const h = fixture(); expect(() => assertShellCaller({ ...h.event, senderFrame: { ...h.frame } } as Electron.IpcMainInvokeEvent, h.windows, "/moon")).toThrow(); });
  it("rejects destroyed, detached, unregistered and replaced contents", () => {
    for (const mutate of [
      (h: ReturnType<typeof fixture>) => { h.sender.isDestroyed = () => true; },
      (h: ReturnType<typeof fixture>) => { h.frame.detached = true; },
      (h: ReturnType<typeof fixture>) => { h.window.isDestroyed = () => true; },
      (h: ReturnType<typeof fixture>) => { h.windows.get = () => undefined; },
      (h: ReturnType<typeof fixture>) => { h.window.webContents = { ...h.sender }; }
    ]) { const h = fixture(); mutate(h); expect(() => assertShellCaller(h.event, h.windows, "/moon")).toThrow(); }
  });
  it("bounds argument types, size and recursion", () => {
    expect(() => assertBoundedPayload({ url: "https://example.com", tabId: "1" })).not.toThrow();
    for (const value of [NaN, Infinity, new Date(), "x".repeat(8_000_001), JSON.parse('{"__proto__":{}}')]) expect(() => assertBoundedPayload(value)).toThrow();
    const cycle: unknown[] = []; cycle.push(cycle); expect(() => assertBoundedPayload(cycle)).toThrow();
  });
});
