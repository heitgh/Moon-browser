import type { MoonDatabase } from "../database/database.js";
import { JsonRepository } from "./json-repository.js";
export interface WallpaperRecord {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly type: "image" | "gradient" | "color";
  readonly thumbnailData?: string;
  readonly mimeType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  readonly bytes?: number;
  readonly hash?: string;
  readonly favorite?: boolean;
  readonly tags?: readonly string[];
  readonly fit?: "cover" | "contain" | "center" | "repeat";
  readonly position?: string;
  readonly repeat?: boolean;
  readonly createdAt: number;
  readonly updatedAt?: number;
}
export class WallpaperRepository extends JsonRepository<WallpaperRecord> {
  constructor(database: MoonDatabase) { super(database, "wallpapers"); }
  async list(type?: WallpaperRecord["type"]) { return [...await this.filter(value => !type || value.type === type)].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)); }
}
