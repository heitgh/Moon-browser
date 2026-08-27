import type { BrowserWindowOptions, Platform } from "@moon/platform";
import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { BrowserLifecycleState, BrowserModel, BrowserWindowModel } from "./browser.js";
import { createBrowserState } from "./browser-state.js";

export class BrowserManager {
  #state: BrowserModel = createBrowserState();
  constructor(readonly platform: Platform, readonly eventBus: MoonEventBus = moonEventBus) {}
  get state(): Readonly<BrowserModel> { return this.#state; }
  async initialize(): Promise<void> { await this.#setLifecycle("initializing"); await this.#setLifecycle("ready"); }
  async createWindow(options?: BrowserWindowOptions): Promise<BrowserWindowModel> {
    const id = await this.platform.browser.createWindow(options); const model = { id, active: true, focused: true, createdAt: Date.now() };
    this.#state = { ...this.#state, windows: { ...this.#state.windows, [id]: model }, activeWindowId: id };
    await this.eventBus.publish("browser:window-created", { window: model }, { context: { windowId: id }, source: { type: "core", id: "browser-manager" } }); return model;
  }
  async closeWindow(id: string): Promise<void> { await this.platform.browser.closeWindow(id); const { [id]: removed, ...windows } = this.#state.windows; void removed; this.#state = { ...this.#state, windows, activeWindowId: this.#state.activeWindowId === id ? Object.keys(windows)[0] : this.#state.activeWindowId }; await this.eventBus.publish("browser:window-closed", { windowId: id }, { context: { windowId: id }, source: { type: "core", id: "browser-manager" } }); }
  async shutdown(): Promise<void> { await this.#setLifecycle("shutting-down"); await this.platform.browser.destroy(); await this.#setLifecycle("destroyed"); }
  async #setLifecycle(lifecycle: BrowserLifecycleState): Promise<void> { const previousState = this.#state.lifecycle; this.#state = { ...this.#state, lifecycle }; await this.eventBus.publish("browser:lifecycle", { state: lifecycle, previousState }, { source: { type: "core", id: "browser-manager" } }); }
}
