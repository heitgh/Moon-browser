import type { TabModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class TabRepository extends JsonRepository<TabModel> {
  constructor(database: MoonDatabase) { super(database, "tabs"); }
  async listByWindow(windowId: string) { return [...await this.filter(value => value.windowId === windowId)].sort((a, b) => a.position - b.position); }
  async listByWorkspace(workspaceId: string) { return [...await this.filter(value => value.workspaceId === workspaceId)].sort((a, b) => a.position - b.position); }
}
