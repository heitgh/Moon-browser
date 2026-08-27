import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface TaskRecord { readonly id: string; readonly title: string; readonly completed: boolean; readonly dueAt?: number; readonly workspaceId?: string; readonly createdAt: number; readonly updatedAt: number; }
export class TaskRepository extends JsonRepository<TaskRecord> {
  constructor(database: MoonDatabase) { super(database, "tasks"); }
  async list(workspaceId?: string, completed?: boolean) { return [...await this.filter(value => (!workspaceId || value.workspaceId === workspaceId) && (completed === undefined || value.completed === completed))].sort((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER)); }
}
