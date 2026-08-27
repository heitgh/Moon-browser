import { MoonEventBus, moonEventBus } from "../events/event-bus.js";
import type { MoonEventSubscription } from "../events/event-types.js";
import { createInitialMoonState, type MoonState } from "./moon-state.js";
import type {
  MoonStateChangedEvent,
  MoonStateChangeReason
} from "./state-events.js";

export type MoonStateUpdater = (
  state: Readonly<MoonState>
) => MoonState;

export class MoonStateStore {
  #state: MoonState;
  readonly #eventBus: MoonEventBus;

  constructor(
    initialState: MoonState = createInitialMoonState(),
    eventBus: MoonEventBus = moonEventBus
  ) {
    this.#state = initialState;
    this.#eventBus = eventBus;
  }

  getState(): Readonly<MoonState> {
    return this.#state;
  }

  async setState(
    updater: MoonStateUpdater,
    reason: MoonStateChangeReason = "system"
  ): Promise<Readonly<MoonState>> {
    const previousState = this.#state;
    const updatedState = updater(previousState);

    if (updatedState === previousState) {
      return this.#state;
    }

    const state: MoonState = {
      ...updatedState,
      version: previousState.version + 1,
      updatedAt: Date.now()
    };

    const changedKeys = this.#getChangedKeys(previousState, state);

    this.#state = state;

    await this.#eventBus.publish(
      "state:changed",
      {
        previousState,
        state,
        reason,
        changedKeys
      },
      { source: { type: "core", id: "state-store" } }
    );

    return this.#state;
  }

  async replaceState(
    state: MoonState,
    reason: MoonStateChangeReason = "hydrate"
  ): Promise<Readonly<MoonState>> {
    return this.setState(() => state, reason);
  }

  subscribe(
    listener: (event: MoonStateChangedEvent) => void | Promise<void>
  ): MoonEventSubscription {
    return this.#eventBus.subscribe<MoonStateChangedEvent>(
      "state:changed",
      listener
    );
  }

  #getChangedKeys(
    previousState: MoonState,
    state: MoonState
  ): readonly (keyof MoonState)[] {
    return (Object.keys(state) as (keyof MoonState)[]).filter(
      key => previousState[key] !== state[key]
    );
  }
}

export const moonStateStore = new MoonStateStore();
