export type MoonEventSourceType =
  | "core"
  | "application"
  | "platform"
  | "ui"
  | "extension"
  | "plugin"
  | "system";

export interface MoonEventSource {
  readonly type: MoonEventSourceType;
  readonly id?: string;
}

export interface MoonEventContext {
  readonly windowId?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
}

export interface MoonEvent<
  TType extends string = string,
  TPayload = unknown
> {
  readonly id: string;
  readonly type: TType;
  readonly payload: TPayload;
  readonly timestamp: number;
  readonly source: MoonEventSource;
  readonly context?: MoonEventContext;
}

export type MoonEventHandler<
  TEvent extends MoonEvent = MoonEvent
> = (
  event: TEvent
) => void | Promise<void>;

export type MoonEventFilter<
  TEvent extends MoonEvent = MoonEvent
> = (
  event: TEvent
) => boolean;

export interface MoonEventSubscriptionOptions<
  TEvent extends MoonEvent = MoonEvent
> {
  readonly once?: boolean;
  readonly priority?: number;
  readonly filter?: MoonEventFilter<TEvent>;
}

export interface MoonEventSubscription {
  readonly id: string;
  readonly eventType: string;

  unsubscribe(): void;
}

export type MoonEventMap = Readonly<
  Record<string, MoonEvent<string, unknown>>
>;
