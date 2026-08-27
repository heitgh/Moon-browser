import type { TabModel } from "../models/tab-model.js";

export interface TabState {
  readonly tabs: Readonly<Record<string, TabModel>>;
  readonly activeTabId?: string;
}

export function createTabState(
  tabs: readonly TabModel[] = [],
  activeTabId?: string
): TabState {
  return {
    tabs: Object.fromEntries(tabs.map(tab => [tab.id, tab])),
    activeTabId: activeTabId ?? tabs.find(tab => tab.active)?.id
  };
}

export function selectTabsByWindow(
  state: TabState,
  windowId: string
): readonly TabModel[] {
  return Object.values(state.tabs)
    .filter(tab => tab.windowId === windowId)
    .sort((left, right) => left.position - right.position);
}

export function selectTabsByWorkspace(
  state: TabState,
  workspaceId: string
): readonly TabModel[] {
  return Object.values(state.tabs)
    .filter(tab => tab.workspaceId === workspaceId)
    .sort((left, right) => left.position - right.position);
}

export function selectActiveTab(
  state: TabState
): TabModel | undefined {
  return state.activeTabId
    ? state.tabs[state.activeTabId]
    : undefined;
}
