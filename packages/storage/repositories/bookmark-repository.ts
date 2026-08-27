import type { BookmarkModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class BookmarkRepository extends JsonRepository<BookmarkModel> {
  constructor(database: MoonDatabase) { super(database, "bookmarks"); }
  list(workspaceId?: string) { return workspaceId ? this.filter(value => value.workspaceId === workspaceId) : this.all(); }
  search(query: string) { const term = query.trim().toLocaleLowerCase(); return this.filter(value => [value.title, value.url, value.description, ...value.tags].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)); }
}
