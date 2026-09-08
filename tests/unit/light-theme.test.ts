// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { CustomizationApplier } from "../../ui/customization/customization-applier.js";
import { createDefaultCustomization } from "../../ui/customization/customization-schema.js";
it("changes all semantic chrome surfaces with light mode and restores dark colors", () => {
  const config = createDefaultCustomization().global;
  const light = { ...config, appearance: { ...config.appearance, mode: "light" as const } };
  const root = document.createElement("div"); const applier = new CustomizationApplier(root);
  applier.apply(light);
  for (const key of ["toolbar", "tabs", "sidebar", "home", "content"] as const) {
    expect(root.style.getPropertyValue(`--moon-region-${key}`)).not.toBe(config.appearance.regions[key]);
    expect(parseInt(root.style.getPropertyValue(`--moon-region-${key}`).slice(1, 3), 16)).toBeGreaterThan(220);
  }
  applier.apply(config); expect(root.style.getPropertyValue("--moon-region-toolbar")).toBe(config.appearance.regions.toolbar); applier.dispose();
});
