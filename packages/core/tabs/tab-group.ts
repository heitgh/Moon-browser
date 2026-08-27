import type { Tab } from "./tab.js";

export interface TabGroupModel {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly collapsed: boolean;
  readonly workspaceId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export class TabGroup {
  #model: TabGroupModel;
  readonly #tabIds = new Set<string>();

  constructor(
    model: TabGroupModel,
    tabIds: readonly string[] = []
  ) {
    this.#model = model;

    for (const tabId of tabIds) {
      this.#tabIds.add(tabId);
    }
  }

  get model(): Readonly<TabGroupModel> {
    return this.#model;
  }

  get tabIds(): readonly string[] {
    return [...this.#tabIds];
  }

  add(tab: Tab): void {
    this.#tabIds.add(tab.id);
  }

  remove(tabId: string): boolean {
    return this.#tabIds.delete(tabId);
  }

  has(tabId: string): boolean {
    return this.#tabIds.has(tabId);
  }

  rename(name: string): void {
    this.#model = {
      ...this.#model,
      name,
      updatedAt: Date.now()
    };
  }

  setCollapsed(collapsed: boolean): void {
    this.#model = {
      ...this.#model,
      collapsed,
      updatedAt: Date.now()
    };
  }
}
