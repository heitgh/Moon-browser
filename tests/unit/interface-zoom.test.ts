import { describe, expect, it, vi } from "vitest";
import type { Input, WebContents } from "electron";
import { changeInterfaceZoom, installInterfaceWheel, installZoomShortcuts, nextZoom, zoomAction } from "../../apps/desktop/electron/main/interface-zoom.js";

const input = (key: string, code = "Equal"): Input => ({ type: "keyDown", key, code, control: true, meta: false, alt: false, shift: false, isAutoRepeat: false, isComposing: false, location: 0, modifiers: [] });
describe("interface zoom recovery", () => {
  it("accepts plus with/without shift and numpad, minus and reset", () => {
    for (const key of ["+", "="]) expect(zoomAction(input(key))).toBe("in");
    expect(zoomAction(input("Add", "NumpadAdd"))).toBe("in");
    expect(zoomAction(input("-", "Minus"))).toBe("out");
    expect(zoomAction(input("0", "Digit0"))).toBe("reset");
    expect(zoomAction({ ...input("="), control: false })).toBeUndefined();
    expect(zoomAction({ ...input("="), type: "keyUp" })).toBeUndefined();
  });
  it("can increase again from the minimum and reset any previous zoom", () => {
    expect(nextZoom(.5, "in")).toBe(.6);
    expect(nextZoom(.5, "out")).toBe(.5);
    expect(nextZoom(2, "in")).toBe(2);
    expect(nextZoom(.3, "reset")).toBe(1);
    expect(nextZoom(nextZoom(1, "out"), "in")).toBe(1);
  });
  it("routes keyboard zoom to the supplied page without changing the shell", () => {
    let listener: (event: { preventDefault(): void }, input: Input) => void = () => {};
    const source = { on: vi.fn((_name, handler) => { listener = handler; }) };
    const shell = { isDestroyed: () => false, getZoomFactor: () => .5, setZoomFactor: vi.fn() };
    installZoomShortcuts(source as unknown as WebContents, action => changeInterfaceZoom(shell as unknown as WebContents, action));
    const event = { preventDefault: vi.fn() };
    listener(event, input("+"));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(shell.setZoomFactor).toHaveBeenCalledWith(.6);
  });

});

it("converts renderer CSS bounds at interface zoom before positioning native pages", async () => {
  const { registerBrowserIpc } = await import("../../apps/desktop/electron/ipc/browser-ipc.js");
  const handlers = new Map<string, (event: unknown, payload: unknown) => void>();
  const setBounds = vi.fn();
  registerBrowserIpc(
    { register: (name: string, handler: (event: unknown, payload: unknown) => void) => handlers.set(name, handler) } as unknown as Parameters<typeof registerBrowserIpc>[0],
    { setBounds } as unknown as Parameters<typeof registerBrowserIpc>[1],
    { idForWebContents: () => "window-1" } as unknown as Parameters<typeof registerBrowserIpc>[2],
    async () => {}
  );
  handlers.get("browser:set-bounds")!({ sender: { getZoomFactor: () => 1.5 } }, { x: 60, y: 100, width: 800, height: 400 });
  expect(setBounds).toHaveBeenCalledWith("window-1", { x: 90, y: 150, width: 1200, height: 600 });
});

it("routes native Ctrl wheel gestures to the shell independently of page zoom", async () => {
  let listener: (event: unknown, direction: "in" | "out") => void = () => {};
  const source = { on: vi.fn((_name, handler) => { listener = handler; }) };
  const shell = { isDestroyed: () => false, getZoomFactor: () => 1, setZoomFactor: vi.fn() };
  installInterfaceWheel(source as unknown as WebContents, shell as unknown as WebContents);
  expect(source.on).toHaveBeenCalledWith("zoom-changed", expect.any(Function));
  listener({ preventDefault: vi.fn() }, "in"); await new Promise(resolve => setImmediate(resolve)); expect(shell.setZoomFactor).toHaveBeenLastCalledWith(1.1);
  listener({ preventDefault: vi.fn() }, "out"); await new Promise(resolve => setImmediate(resolve)); expect(shell.setZoomFactor).toHaveBeenLastCalledWith(.9);
});

it("migrates older official configurations without resetting wallpaper settings", async () => {
  const { createDefaultCustomization, validateCustomization } = await import("../../ui/customization/customization-schema.js");
  const saved = createDefaultCustomization();
  delete (saved.global.appearance.wallpaper as { extendToChrome?: boolean }).extendToChrome;
  const restored = validateCustomization(saved);
  expect(restored.global.appearance.wallpaper.extendToChrome).toBe(true);
  expect(restored.global.appearance.wallpaper.source).toBe(saved.global.appearance.wallpaper.source);
});
