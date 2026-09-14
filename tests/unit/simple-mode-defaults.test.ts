import { describe, expect, it } from "vitest";
import { createDefaultCustomization } from "../../ui/customization/customization-schema.js";

describe("simple mode defaults", () => {
  it("starts compact and calm without removing advanced customization", () => {
    const defaults = createDefaultCustomization();
    expect(defaults.experience.mode).toBe("simple");
    expect(defaults.global.layout.density).toBe("compact");
    expect(defaults.global.layout.toolbar.height).toBe(42);
    expect(defaults.global.layout.tabs.width).toBe(196);
    expect(defaults.global.layout.sidebar.width).toBe(48);
    expect(defaults.global.layout.drawer.mode).toBe("fixed");
    expect(defaults.global.workspaceDisplay.visibility).toBe("home-only");
    expect(defaults.global.home.preset).toBe("minimal");
    expect(defaults.global.layout.statusBar.visible).toBe(false);
    expect(defaults.global.search.providers.length).toBeGreaterThan(0);
    expect(defaults.global.icons.overrides).toEqual({});
  });
});
