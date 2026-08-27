import { MoonError } from "../errors/moon-error.js";
import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { CreateSessionInput, SessionModel } from "../models/session-model.js";
import { MoonStateStore, moonStateStore } from "../state/state-store.js";
import { Session } from "./session.js";

export class SessionManager {
  readonly #sessions = new Map<string, Session>();
  #nextId = 0;
  constructor(readonly eventBus: MoonEventBus = moonEventBus, readonly stateStore: MoonStateStore = moonStateStore) {}

  async create(input: CreateSessionInput): Promise<Readonly<SessionModel>> {
    const now = Date.now();
    const model: SessionModel = {
      id: `session-${now}-${++this.#nextId}`, name: input.name, status: "active",
      workspaceId: input.workspaceId, tabs: [], createdAt: now, updatedAt: now
    };
    this.#sessions.set(model.id, new Session(model));
    await this.#persist();
    await this.eventBus.publish("session:created", { session: model }, { source: { type: "core", id: "session-manager" } });
    return model;
  }

  get(id: string): Readonly<SessionModel> | undefined { return this.#sessions.get(id)?.model; }
  list(): readonly Readonly<SessionModel>[] { return [...this.#sessions.values()].map(value => value.model); }
  require(id: string): Session {
    const session = this.#sessions.get(id);
    if (!session) throw new MoonError("SESSION_NOT_FOUND", `Session not found: ${id}`, { context: { id }, recoverable: true });
    return session;
  }
  async activate(id: string): Promise<void> {
    const target = this.require(id);
    const previous = this.list().find(session => session.status === "active");
    for (const session of this.#sessions.values()) session.setStatus(session.id === id ? "active" : "suspended");
    await this.#persist();
    await this.eventBus.publish("session:activated", { session: target.model, previousSessionId: previous?.id }, { context: { sessionId: id }, source: { type: "core", id: "session-manager" } });
  }
  async close(id: string): Promise<void> {
    const session = this.require(id); session.setStatus("closed"); await this.#persist();
    await this.eventBus.publish("session:closed", { session: session.model }, { context: { sessionId: id }, source: { type: "core", id: "session-manager" } });
  }
  async #persist(): Promise<void> {
    const sessions = Object.fromEntries(this.list().map(session => [session.id, session]));
    const activeSessionId = this.list().find(session => session.status === "active")?.id;
    await this.stateStore.setState(state => ({ ...state, sessions, activeSessionId }), "user-action");
  }
}
