import type { TabModel } from "../models/tab-model.js";

export type TabUpdate = Partial<
  Omit<TabModel, "id" | "createdAt">
>;

export class Tab {
  #model: TabModel;

  constructor(model: TabModel) {
    this.#model = model;
  }

  get id(): string {
    return this.#model.id;
  }

  get model(): Readonly<TabModel> {
    return this.#model;
  }

  update(update: TabUpdate): Readonly<TabModel> {
    this.#model = {
      ...this.#model,
      ...update,
      id: this.#model.id,
      createdAt: this.#model.createdAt,
      updatedAt: Date.now()
    };

    return this.#model;
  }

  activate(): Readonly<TabModel> {
    return this.update({ active: true, lastAccessedAt: Date.now() });
  }

  deactivate(): Readonly<TabModel> {
    return this.update({ active: false });
  }

  pin(): Readonly<TabModel> {
    return this.update({ pinned: true });
  }

  unpin(): Readonly<TabModel> {
    return this.update({ pinned: false });
  }

  setMuted(muted: boolean): Readonly<TabModel> {
    return this.update({ muted });
  }
}
