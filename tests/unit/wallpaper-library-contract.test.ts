import { describe, expect, it } from "vitest";
import { parseWallpaperLibraryUpdate } from "../../packages/ipc/wallpaper-library-contract.js";

describe("wallpaper library contract", () => {
  it("normalizes editable metadata and removes duplicate tags", () => {
    expect(parseWallpaperLibraryUpdate({ id: "wallpaper-1234567890abcdef", name: "  Aurora  ", favorite: true, tags: ["céu", "céu", "noite"], fit: "cover", position: "center", repeat: false })).toEqual({ id: "wallpaper-1234567890abcdef", name: "Aurora", favorite: true, tags: ["céu", "noite"], fit: "cover", position: "center", repeat: false });
  });

  it("rejects arbitrary identifiers and unsafe metadata", () => {
    expect(() => parseWallpaperLibraryUpdate({ id: "../../wallpaper", name: "Moon" })).toThrow(/ID/i);
    expect(() => parseWallpaperLibraryUpdate({ id: "wallpaper-1234567890abcdef", tags: ["x".repeat(41)] })).toThrow(/tag/i);
    expect(() => parseWallpaperLibraryUpdate({ id: "wallpaper-1234567890abcdef", position: "url(javascript:1)" })).toThrow(/position/i);
  });
});
