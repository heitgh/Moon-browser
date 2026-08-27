import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface StoredSetting<T = unknown> { readonly id: string; readonly key: string; readonly value: T; readonly scope: string; readonly updatedAt: number; }
export class SettingsRepository extends JsonRepository<StoredSetting> {
  constructor(database: MoonDatabase) { super(database, "settings"); }
  async getValue<T>(key: string, scope = "global"): Promise<T | undefined> { const setting = (await this.filter(value => value.key === key && value.scope === scope))[0]; return setting?.value as T | undefined; }
  async setValue<T>(key: string, value: T, scope = "global"): Promise<void> { await this.save({ id: `${scope}:${key}`, key, value, scope, updatedAt: Date.now() }); }
  async listScope(scope: string) { return this.filter(value => value.scope === scope); }
}
