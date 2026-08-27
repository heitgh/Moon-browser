import { describe, expect, it } from "vitest";
import { createMoonProfileBackup, parseMoonProfileBackup } from "../../packages/storage/backup/profile-backup.js";

const validData = {
  bookmarks: [{ id: "bookmark-1", title: "Moon", url: "https://moon.test/", time: 1 }],
  history: [],
  notes: "startup",
  shortcuts: [{ id: "shortcut-1", name: "Moon", url: "https://moon.test/" }],
  themes: [],
  workspaces: [{ id: "research", name: "Pesquisa" }],
  preferences: { accent: "#8a5cf5", wallpaper: "./assets/wallpapers/aurora.svg", searchEngine: "duckduckgo" as const, showClock: true, showShortcuts: true, glassHome: true }
};

describe("Moon profile backup schema", () => {
  it("round-trips a canonical versioned profile", () => {
    const backup = createMoonProfileBackup(validData);
    expect(parseMoonProfileBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it("rejects dangerous URL protocols and duplicate identities", () => {
    const dangerous = { ...createMoonProfileBackup(validData), shortcuts: [{ id: "x", name: "X", url: "javascript:alert(1)" }] };
    expect(() => parseMoonProfileBackup(JSON.stringify(dangerous))).toThrow(/protocol/);
    const duplicate = { ...createMoonProfileBackup(validData), workspaces: [{ id: "x", name: "One" }, { id: "x", name: "Two" }] };
    expect(() => parseMoonProfileBackup(JSON.stringify(duplicate))).toThrow(/Duplicate IDs/);
  });

  it("rejects unsupported versions, invalid colors and oversized content", () => {
    expect(() => parseMoonProfileBackup(JSON.stringify({ ...createMoonProfileBackup(validData), version: 2 }))).toThrow(/Unsupported/);
    expect(() => createMoonProfileBackup({ ...validData, preferences: { ...validData.preferences, accent: "red" } })).toThrow(/accent color/);
    expect(() => parseMoonProfileBackup("x".repeat(5_000_001))).toThrow(/too large/);
  });
});
