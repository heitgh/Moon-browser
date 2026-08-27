import { describe, expect, it, vi } from "vitest";
import { MoonEventEmitter } from "../../packages/core/events/event-emitter.js";
import type { MoonEvent } from "../../packages/core/events/event-types.js";

interface TestEvent extends MoonEvent<"test:event", { readonly value: number }> {}

const testEvent = (): TestEvent => ({
  id: "event-1",
  type: "test:event",
  payload: { value: 1 },
  timestamp: Date.now(),
  source: { type: "core", id: "unit-test" }
});

describe("MoonEventEmitter", () => {
  it("runs higher-priority listeners first", async () => {
    const emitter = new MoonEventEmitter();
    const calls: string[] = [];
    emitter.on<TestEvent>("test:event", () => { calls.push("low"); }, { priority: 1 });
    emitter.on<TestEvent>("test:event", () => { calls.push("high"); }, { priority: 10 });

    await emitter.emit<TestEvent>(testEvent());

    expect(calls).toEqual(["high", "low"]);
  });

  it("removes one-time listeners after the first event", async () => {
    const emitter = new MoonEventEmitter();
    const listener = vi.fn();
    emitter.once<TestEvent>("test:event", listener);
    const event = testEvent();

    await emitter.emit(event);
    await emitter.emit(event);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
