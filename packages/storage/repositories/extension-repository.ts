import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface StoredExtension { readonly id: string; readonly name: string; readonly version: string; readonly enabled: boolean; readonly manifest: string; readonly installedAt: number; readonly updatedAt: number; }
export class ExtensionRepository extends JsonRepository<StoredExtension> {
  constructor(database: MoonDatabase) { super(database, "extensions"); }
  async list(enabledOnly = false) { return [...await this.filter(value => !enabledOnly || value.enabled)].sort((a, b) => a.name.localeCompare(b.name)); }
}
