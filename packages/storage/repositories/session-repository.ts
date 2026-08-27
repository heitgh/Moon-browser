import type { SessionModel } from "@moon/core";
import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export class SessionRepository extends JsonRepository<SessionModel> {
  constructor(database: MoonDatabase) { super(database, "sessions"); }
  list(workspaceId?: string, includeClosed = false) { return this.filter(value => (!workspaceId || value.workspaceId === workspaceId) && (includeClosed || value.status !== "closed")); }
}
