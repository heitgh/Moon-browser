import { describe, expect, it } from "vitest";
import { createDefaultCustomization } from "../../ui/customization/customization-schema.js";
import { parseMoonHome, serializeMoonHome } from "../../ui/customization/moon-home-contract.js";

describe(".moonhome contract", () => {
  it("round-trips a complete versioned Home layout", () => {
    const home = createDefaultCustomization().global.home;
    expect(parseMoonHome(serializeMoonHome(home))).toEqual(home);
  });

  it("rejects unknown fields and invalid widget identities", () => {
    expect(() => parseMoonHome(JSON.stringify({ format: "moon-home", version: 1, home: createDefaultCustomization().global.home, script: "bad" }))).toThrow(/não permitido/i);
    const home = structuredClone(createDefaultCustomization().global.home);
    (home.widgets[0] as { id: string }).id = "remote-script";
    expect(() => parseMoonHome(JSON.stringify({ format: "moon-home", version: 1, home }))).toThrow(/widget/i);
  });
});
