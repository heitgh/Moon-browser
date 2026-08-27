import type { NoteModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class NoteRepository extends JsonRepository<NoteModel> {
  constructor(database: MoonDatabase) { super(database, "notes"); }
  list(workspaceId?: string, includeArchived = false) { return this.filter(value => (!workspaceId || value.workspaceId === workspaceId) && (includeArchived || !value.archived)); }
  search(query: string) { const term = query.trim().toLocaleLowerCase(); return this.filter(value => `${value.title} ${value.content} ${value.tags.join(" ")}`.toLocaleLowerCase().includes(term)); }
}
