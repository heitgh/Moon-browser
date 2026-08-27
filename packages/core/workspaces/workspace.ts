import type { WorkspaceAppearance, WorkspaceLayout, WorkspaceModel } from "../models/workspace-model.js";

export class Workspace {
  #model: WorkspaceModel;
  constructor(model: WorkspaceModel) { this.#model = model; }
  get id(): string { return this.#model.id; }
  get model(): Readonly<WorkspaceModel> { return this.#model; }
  rename(name: string): void { this.#update({ name }); }
  setLayout(layout: WorkspaceLayout): void { this.#update({ layout }); }
  setAppearance(appearance: WorkspaceAppearance): void { this.#update({ appearance }); }
  archive(): void { this.#update({ archived: true }); }
  restore(): void { this.#update({ archived: false }); }
  touch(): void { this.#update({ lastAccessedAt: Date.now() }); }
  #update(update: Partial<WorkspaceModel>): void {
    this.#model = { ...this.#model, ...update, id: this.#model.id, updatedAt: Date.now() };
  }
}
