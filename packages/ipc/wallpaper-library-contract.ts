export type WallpaperFit = "cover" | "contain" | "center" | "repeat";

export interface WallpaperLibrarySummary {
  readonly id: string;
  readonly name: string;
  readonly thumbnailData: string;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  readonly bytes: number;
  readonly favorite: boolean;
  readonly tags: readonly string[];
  readonly fit: WallpaperFit;
  readonly position: string;
  readonly repeat: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface WallpaperLibraryItem extends WallpaperLibrarySummary {
  readonly data: string;
}

export interface WallpaperLibraryUpdate {
  readonly id: string;
  readonly name?: string;
  readonly favorite?: boolean;
  readonly tags?: readonly string[];
  readonly fit?: WallpaperFit;
  readonly position?: string;
  readonly repeat?: boolean;
}

export function parseWallpaperLibraryUpdate(value: unknown): WallpaperLibraryUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid wallpaper update");
  const input = value as Readonly<Record<string, unknown>>;
  if (typeof input.id !== "string" || !/^wallpaper-[a-f0-9]{16,64}$/.test(input.id)) throw new TypeError("Invalid wallpaper ID");
  const update: { id: string; name?: string; favorite?: boolean; tags?: readonly string[]; fit?: WallpaperFit; position?: string; repeat?: boolean } = { id: input.id };
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) throw new TypeError("Invalid wallpaper name");
    update.name = input.name.trim();
  }
  if (input.favorite !== undefined) {
    if (typeof input.favorite !== "boolean") throw new TypeError("Invalid favorite state");
    update.favorite = input.favorite;
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 20) throw new TypeError("Invalid wallpaper tags");
    update.tags = [...new Set(input.tags.map(tag => {
      if (typeof tag !== "string" || !tag.trim() || tag.trim().length > 40) throw new TypeError("Invalid wallpaper tag");
      return tag.trim();
    }))];
  }
  if (input.fit !== undefined) {
    if (!(["cover", "contain", "center", "repeat"] as const).includes(input.fit as WallpaperFit)) throw new TypeError("Invalid wallpaper fit");
    update.fit = input.fit as WallpaperFit;
  }
  if (input.position !== undefined) {
    if (typeof input.position !== "string" || !/^(center|top|bottom|left|right)( (center|top|bottom|left|right))?$/.test(input.position)) throw new TypeError("Invalid wallpaper position");
    update.position = input.position;
  }
  if (input.repeat !== undefined) {
    if (typeof input.repeat !== "boolean") throw new TypeError("Invalid wallpaper repeat state");
    update.repeat = input.repeat;
  }
  return update;
}
