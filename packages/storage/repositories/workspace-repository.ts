import type { WorkspaceModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class WorkspaceRepository extends JsonRepository<WorkspaceModel> {
  constructor(database: MoonDatabase) { super(database, "workspaces"); }
  async list(includeArchived = false) { return [...await this.filter(value => includeArchived || !value.archived)].sort((a, b) => a.position - b.position); }
}
