import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("reserves trusted Ctrl wheel for UI and leaves ordinary scrolling alone", () => {
  let listener: (event: Record<string, unknown>) => void = () => {};
  const send = vi.fn();
  runInNewContext(readFileSync("zoom-preload.cjs", "utf8"), {
    require: () => ({ ipcRenderer: { send } }),
    window: { addEventListener: (_name: string, handler: typeof listener) => { listener = handler; } }
  });
  const preventDefault = vi.fn();
  const event = { isTrusted: true, ctrlKey: true, deltaY: -100, preventDefault, stopImmediatePropagation: vi.fn() };
  listener(event); expect(send).toHaveBeenLastCalledWith("browser:ui-wheel", "in");
  listener({ ...event, deltaY: 100 }); expect(send).toHaveBeenLastCalledWith("browser:ui-wheel", "out");
  expect(preventDefault).toHaveBeenCalledTimes(2);
  listener({ ...event, ctrlKey: false }); listener({ ...event, isTrusted: false });
  expect(send).toHaveBeenCalledTimes(2);
});
