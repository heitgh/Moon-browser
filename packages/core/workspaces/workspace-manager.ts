import { MoonError } from "../errors/moon-error.js";
import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { CreateWorkspaceInput, WorkspaceModel } from "../models/workspace-model.js";
import { MoonStateStore, moonStateStore } from "../state/state-store.js";
import { Workspace } from "./workspace.js";

export class WorkspaceManager {
  readonly #items = new Map<string, Workspace>(); #nextId = 0;
  constructor(readonly eventBus: MoonEventBus = moonEventBus, readonly stateStore: MoonStateStore = moonStateStore) {}
  async create(input: CreateWorkspaceInput): Promise<Readonly<WorkspaceModel>> {
    const now = Date.now();
    const model: WorkspaceModel = {
      id: `workspace-${now}-${++this.#nextId}`, name: input.name, description: input.description,
      position: this.#items.size, layout: input.layout ?? "standard", appearance: input.appearance ?? {},
      default: this.#items.size === 0, archived: false, createdAt: now, updatedAt: now, lastAccessedAt: now
    };
    this.#items.set(model.id, new Workspace(model)); await this.#persist();
    await this.eventBus.publish("workspace:created", { workspace: model }, { context: { workspaceId: model.id }, source: { type: "core", id: "workspace-manager" } });
    return model;
  }
  list(includeArchived = false): readonly Readonly<WorkspaceModel>[] { return [...this.#items.values()].map(item => item.model).filter(item => includeArchived || !item.archived).sort((a,b) => a.position-b.position); }
  get(id: string): Readonly<WorkspaceModel> | undefined { return this.#items.get(id)?.model; }
  require(id: string): Workspace { const item = this.#items.get(id); if (!item) throw new MoonError("WORKSPACE_NOT_FOUND", `Workspace not found: ${id}`, { context: { id }, recoverable: true }); return item; }
  async activate(id: string): Promise<void> { const item = this.require(id); const previous = this.stateStore.getState().activeWorkspaceId; item.touch(); await this.#persist(id); await this.eventBus.publish("workspace:activated", { workspace: item.model, previousWorkspaceId: previous }, { context: { workspaceId: id }, source: { type: "core", id: "workspace-manager" } }); }
  async archive(id: string): Promise<void> { const item = this.require(id); if (item.model.default) throw new MoonError("DEFAULT_WORKSPACE_ARCHIVE", "The default workspace cannot be archived", { recoverable: true }); item.archive(); await this.#persist(); await this.eventBus.publish("workspace:archived", { workspace: item.model }, { context: { workspaceId: id }, source: { type: "core", id: "workspace-manager" } }); }
  async #persist(activeWorkspaceId = this.stateStore.getState().activeWorkspaceId): Promise<void> { const workspaces = Object.fromEntries(this.list(true).map(item => [item.id, item])); await this.stateStore.setState(state => ({ ...state, workspaces, activeWorkspaceId }), "user-action"); }
}
