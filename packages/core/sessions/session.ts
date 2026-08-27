import type { SessionModel, SessionStatus, SessionTabSnapshot } from "../models/session-model.js";

export class Session {
  #model: SessionModel;
  constructor(model: SessionModel) { this.#model = model; }
  get id(): string { return this.#model.id; }
  get model(): Readonly<SessionModel> { return this.#model; }

  rename(name: string): void { this.#update({ name }); }
  setActiveTab(activeTabId?: string): void { this.#update({ activeTabId }); }
  setTabs(tabs: readonly SessionTabSnapshot[]): void { this.#update({ tabs }); }
  setStatus(status: SessionStatus): void {
    const now = Date.now();
    this.#update({
      status,
      suspendedAt: status === "suspended" ? now : this.#model.suspendedAt,
      closedAt: status === "closed" ? now : this.#model.closedAt
    });
  }

  #update(update: Partial<SessionModel>): void {
    this.#model = { ...this.#model, ...update, id: this.#model.id, updatedAt: Date.now() };
  }
}
