import type { NavigationEntry, NavigationResult } from "./navigation.js";

export interface TabNavigationState {
  readonly tabId: string;
  readonly entries: readonly NavigationEntry[];
  readonly currentIndex: number;
  readonly pending?: NavigationResult;
}

export function createNavigationState(tabId: string): TabNavigationState {
  return { tabId, entries: [], currentIndex: -1 };
}

export function currentNavigationEntry(
  state: TabNavigationState
): NavigationEntry | undefined {
  return state.entries[state.currentIndex];
}

export function canNavigateBack(state: TabNavigationState): boolean {
  return state.currentIndex > 0;
}

export function canNavigateForward(state: TabNavigationState): boolean {
  return state.currentIndex < state.entries.length - 1;
}
