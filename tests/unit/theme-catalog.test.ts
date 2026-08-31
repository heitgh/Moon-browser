import { describe, expect, it } from "vitest";
import { createDefaultCustomization } from "../../ui/customization/customization-schema.js";
import { buildThemeCatalog } from "../../ui/customization/theme-catalog.js";

describe("ThemeCatalog", () => {
  it("normalizes builtin, user and .moontheme records into one ordered catalog", () => {
    const user = { id: "user-theme", name: "Meu tema", createdAt: 20, updatedAt: 20, version: 1, favorite: false, useCount: 0, includes: ["colors", "wallpaper", "effects", "typography", "icons", "layout", "home"] as const, history: [], config: createDefaultCustomization().global };
    const packageTheme = { id: "package-theme", packageId: "studio.theme", name: "Studio", version: "2.0.0", author: "Moon Labs", trust: "official" as const, active: true, installedAt: 30 };
    const catalog = buildThemeCatalog([user], [packageTheme]);
    expect(catalog.map(theme => theme.source)).toEqual(["moontheme", "builtin", "user"]);
    expect(catalog[0]).toMatchObject({ id: "package-theme", active: true, trust: "official", packageId: "studio.theme" });
    expect(catalog.find(theme => theme.id === "user-theme")?.capabilities).toContain("home");
  });

  it("uses the preview selection as active without mutating source records", () => {
    const source = { id: "user-theme", name: "Meu tema", createdAt: 20, updatedAt: 20, version: 1, favorite: false, useCount: 0, includes: ["colors", "wallpaper", "effects", "typography", "icons", "layout", "home"] as const, history: [], config: createDefaultCustomization().global };
    const catalog = buildThemeCatalog([source], [], source.id);
    expect(catalog.find(theme => theme.id === source.id)?.active).toBe(true);
    expect(catalog.filter(theme => theme.active)).toHaveLength(1);
  });
});
