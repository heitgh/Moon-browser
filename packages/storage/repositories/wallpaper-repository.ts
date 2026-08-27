import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface WallpaperRecord { readonly id: string; readonly name: string; readonly source: string; readonly type: "image" | "gradient" | "color"; readonly createdAt: number; }
export class WallpaperRepository extends JsonRepository<WallpaperRecord> {
  constructor(database: MoonDatabase) { super(database, "wallpapers"); }
  async list(type?: WallpaperRecord["type"]) { return [...await this.filter(value => !type || value.type === type)].sort((a, b) => b.createdAt - a.createdAt); }
}
