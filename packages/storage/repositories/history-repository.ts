import type { HistoryModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class HistoryRepository extends JsonRepository<HistoryModel> {
  constructor(database: MoonDatabase) { super(database, "history"); }
  async recent(limit = 100) { return [...await this.all()].sort((a, b) => b.lastVisitedAt - a.lastVisitedAt).slice(0, limit); }
  search(query: string) { const term = query.trim().toLocaleLowerCase(); return this.filter(value => `${value.title} ${value.url}`.toLocaleLowerCase().includes(term)); }
}
