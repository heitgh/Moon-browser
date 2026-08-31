// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOCUS_STORAGE_KEY, FOCUS_SUMMARIES_KEY, FocusSessionController } from "../../ui/focus/focus-session-controller.js";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>(); get length(): number { return this.#values.size; } clear(): void { this.#values.clear(); } getItem(key: string): string | null { return this.#values.get(key) ?? null; } key(index: number): string | null { return [...this.#values.keys()][index] ?? null; } removeItem(key: string): void { this.#values.delete(key); } setItem(key: string, value: string): void { this.#values.set(key, value); }
}

const options = { mode: "timed" as const, preset: "study" as const, durationMinutes: 25, breakMinutes: 5, cycles: 4, alert: true, allowedHosts: ["docs.example"], workspaceIds: ["study"] };

describe("FocusSessionController", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-28T12:00:00Z")); delete document.documentElement.dataset.zen; });
  afterEach(() => { vi.useRealTimers(); delete document.documentElement.dataset.zen; });

  it("persists, pauses, resumes and restores the exact pre-Zen layout on end", async () => {
    const storage = new MemoryStorage(); const controller = new FocusSessionController(document.documentElement, storage); controller.start(options); await Promise.resolve();
    expect(document.documentElement.dataset.zen).toBe("true"); expect(storage.getItem(FOCUS_STORAGE_KEY)).not.toBeNull(); expect(controller.isAllowed("https://docs.example/page", "study")).toBe(true); expect(controller.isAllowed("https://social.example/", "study")).toBe(false);
    vi.advanceTimersByTime(60_000); controller.pause(); const paused = controller.remainingMs(); vi.advanceTimersByTime(60_000); expect(controller.remainingMs()).toBe(paused); controller.resume(); controller.extend(5); expect(controller.remainingMs()).toBe((paused ?? 0) + 5 * 60_000);
    controller.interrupt(); const summary = controller.end(); await Promise.resolve(); expect(summary?.interruptions).toBe(1); expect(summary?.focusedMs).toBe(60_000); expect(document.documentElement.dataset.zen).toBeUndefined(); expect(storage.getItem(FOCUS_STORAGE_KEY)).toBeNull(); expect(JSON.parse(storage.getItem(FOCUS_SUMMARIES_KEY) ?? "[]")).toHaveLength(1); controller.dispose();
  });

  it("recovers normal sessions but keeps private sessions entirely in memory", async () => {
    const storage = new MemoryStorage(); const first = new FocusSessionController(document.documentElement, storage); first.start({ ...options, mode: "continuous" }); expect(first.remainingMs()).toBeNull(); first.dispose();
    const recovered = new FocusSessionController(document.documentElement, storage); expect(recovered.state?.mode).toBe("continuous"); recovered.end(false); await Promise.resolve();
    const privateController = new FocusSessionController(document.documentElement); privateController.start(options); expect(privateController.active).toBe(true); expect(storage.getItem(FOCUS_STORAGE_KEY)).toBeNull(); privateController.end(); await Promise.resolve();
  });
});
