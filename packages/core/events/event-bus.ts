import { MoonEventEmitter } from "./event-emitter.js";
import type {
  MoonEvent,
  MoonEventContext,
  MoonEventHandler,
  MoonEventSource,
  MoonEventSubscription,
  MoonEventSubscriptionOptions
} from "./event-types.js";

export interface MoonEventPublishOptions {
  readonly source?: MoonEventSource;
  readonly context?: MoonEventContext;
  readonly timestamp?: number;
}

export class MoonEventBus {
  readonly #emitter = new MoonEventEmitter();
  #nextEventId = 0;

  subscribe<TEvent extends MoonEvent>(
    eventType: TEvent["type"],
    handler: MoonEventHandler<TEvent>,
    options?: MoonEventSubscriptionOptions<TEvent>
  ): MoonEventSubscription {
    return this.#emitter.on(eventType, handler, options);
  }

  subscribeOnce<TEvent extends MoonEvent>(
    eventType: TEvent["type"],
    handler: MoonEventHandler<TEvent>
  ): MoonEventSubscription {
    return this.#emitter.once(eventType, handler);
  }

  async publish<TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    options: MoonEventPublishOptions = {}
  ): Promise<MoonEvent<TType, TPayload>> {
    const event: MoonEvent<TType, TPayload> = {
      id: `event-${Date.now()}-${++this.#nextEventId}`,
      type,
      payload,
      timestamp: options.timestamp ?? Date.now(),
      source: options.source ?? { type: "core" },
      context: options.context
    };

    await this.#emitter.emit(event);

    return event;
  }

  unsubscribe(eventType: string, subscriptionId: string): void {
    this.#emitter.off(eventType, subscriptionId);
  }

  listenerCount(eventType?: string): number {
    return this.#emitter.listenerCount(eventType);
  }

  clear(eventType?: string): void {
    this.#emitter.clear(eventType);
  }
}

export const moonEventBus = new MoonEventBus();
