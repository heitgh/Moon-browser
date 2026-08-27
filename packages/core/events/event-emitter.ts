import type {
  MoonEvent,
  MoonEventHandler,
  MoonEventSubscription,
  MoonEventSubscriptionOptions
} from "./event-types.js";

interface EventListener<TEvent extends MoonEvent = MoonEvent> {
  readonly id: string;
  readonly handler: MoonEventHandler<TEvent>;
  readonly options: MoonEventSubscriptionOptions<TEvent>;
}

export class MoonEventEmitter {
  readonly #listeners = new Map<string, EventListener[]>();
  #nextSubscriptionId = 0;

  on<TEvent extends MoonEvent>(
    eventType: TEvent["type"],
    handler: MoonEventHandler<TEvent>,
    options: MoonEventSubscriptionOptions<TEvent> = {}
  ): MoonEventSubscription {
    const id = `subscription-${++this.#nextSubscriptionId}`;
    const listener: EventListener<TEvent> = {
      id,
      handler,
      options
    };
    const listeners = this.#listeners.get(eventType) ?? [];

    listeners.push(listener as EventListener);
    listeners.sort(
      (left, right) =>
        (right.options.priority ?? 0) - (left.options.priority ?? 0)
    );

    this.#listeners.set(eventType, listeners);

    return {
      id,
      eventType,
      unsubscribe: () => {
        this.off(eventType, id);
      }
    };
  }

  once<TEvent extends MoonEvent>(
    eventType: TEvent["type"],
    handler: MoonEventHandler<TEvent>
  ): MoonEventSubscription {
    return this.on(eventType, handler, { once: true });
  }

  off(eventType: string, subscriptionId: string): void {
    const listeners = this.#listeners.get(eventType);

    if (!listeners) {
      return;
    }

    const remaining = listeners.filter(
      listener => listener.id !== subscriptionId
    );

    if (remaining.length === 0) {
      this.#listeners.delete(eventType);
      return;
    }

    this.#listeners.set(eventType, remaining);
  }

  async emit<TEvent extends MoonEvent>(event: TEvent): Promise<void> {
    const listeners = [...(this.#listeners.get(event.type) ?? [])];

    for (const listener of listeners) {
      const typedListener = listener as EventListener<TEvent>;

      if (typedListener.options.filter?.(event) === false) {
        continue;
      }

      await typedListener.handler(event);

      if (typedListener.options.once) {
        this.off(event.type, typedListener.id);
      }
    }
  }

  listenerCount(eventType?: string): number {
    if (eventType) {
      return this.#listeners.get(eventType)?.length ?? 0;
    }

    let count = 0;

    for (const listeners of this.#listeners.values()) {
      count += listeners.length;
    }

    return count;
  }

  clear(eventType?: string): void {
    if (eventType) {
      this.#listeners.delete(eventType);
      return;
    }

    this.#listeners.clear();
  }
}
