import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface TimelineRecord { readonly id: string; readonly type: string; readonly payload: string; readonly workspaceId?: string; readonly sessionId?: string; readonly timestamp: number; }
export class TimelineRepository extends JsonRepository<TimelineRecord> {
  constructor(database: MoonDatabase) { super(database, "timeline"); }
  async recent(limit = 100, workspaceId?: string) { return [...await this.filter(value => !workspaceId || value.workspaceId === workspaceId)].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit); }
  async deleteBefore(timestamp: number): Promise<number> { const records = await this.filter(value => value.timestamp < timestamp); let deleted = 0; for (const record of records) if (await this.delete(record.id)) deleted++; return deleted; }
}
