import type { MoonEvent } from "../events/event-types.js";
import type { TabModel } from "../models/tab-model.js";

export type TabCreatedEvent = MoonEvent<
  "tab:created",
  { readonly tab: TabModel }
>;

export type TabUpdatedEvent = MoonEvent<
  "tab:updated",
  {
    readonly tab: TabModel;
    readonly previousTab: TabModel;
  }
>;

export type TabActivatedEvent = MoonEvent<
  "tab:activated",
  {
    readonly tab: TabModel;
    readonly previousTabId?: string;
  }
>;

export type TabClosedEvent = MoonEvent<
  "tab:closed",
  {
    readonly tab: TabModel;
    readonly reason: "user" | "window" | "session" | "system";
  }
>;

export type TabMovedEvent = MoonEvent<
  "tab:moved",
  {
    readonly tab: TabModel;
    readonly previousPosition: number;
    readonly position: number;
  }
>;
