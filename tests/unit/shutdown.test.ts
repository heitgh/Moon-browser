import { afterEach, expect, it, vi } from "vitest";
import { runShutdown } from "../../apps/desktop/electron/main/shutdown.js";
afterEach(() => vi.useRealTimers());
it("does not close the database while flush is stuck, and reports the stalled stage", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const close = vi.fn(async () => {}); const timedOut = vi.fn();
  const pending = runShutdown([
    { name: "flush", run: () => new Promise<void>(resolve => { finish = resolve; }) },
    { name: "database", run: close }
  ], { timeoutMs: 5000, timedOut, failed: vi.fn() });
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBe(false); expect(timedOut).toHaveBeenCalledWith("flush");
  finish(); await Promise.resolve(); expect(close).not.toHaveBeenCalled();
});
it("closes in order and cancels the deadline after success", async () => {
  vi.useFakeTimers(); const order: string[] = []; const timedOut = vi.fn();
  expect(await runShutdown([
    { name: "flush", run: async () => { order.push("flush"); } },
    { name: "database", run: async () => { order.push("database"); } }
  ], { timeoutMs: 5000, timedOut, failed: vi.fn() })).toBe(true);
  await vi.advanceTimersByTimeAsync(6000);
  expect(order).toEqual(["flush", "database"]); expect(timedOut).not.toHaveBeenCalled();
});

it("does not run later shutdown steps when a flush rejects", async () => {
  const closed = vi.fn(async () => undefined);
  const failed = vi.fn();
  const completed = await runShutdown([
    { name: "flush", run: async () => { throw new Error("disk full"); } },
    { name: "close-db", run: closed }
  ], { timeoutMs: 5000, timedOut: vi.fn(), failed });
  expect(completed).toBe(false);
  expect(failed).toHaveBeenCalledWith("flush");
  expect(closed).not.toHaveBeenCalled();
});
