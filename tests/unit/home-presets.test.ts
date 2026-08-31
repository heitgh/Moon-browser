import { describe, expect, it } from "vitest";
import { clone, DEFAULT_CUSTOMIZATION } from "../../ui/customization/customization-schema.js";
import { applyHomePreset, HOME_PRESET_COMPOSITIONS } from "../../ui/customization/home-presets.js";

describe("Home preset compositions", () => {
  it("changes layout composition, widget spans and visual treatment instead of only visibility", () => {
    const focus = clone(DEFAULT_CUSTOMIZATION.home); applyHomePreset(focus, "focus");
    const work = clone(DEFAULT_CUSTOMIZATION.home); applyHomePreset(work, "work");
    expect(focus).toMatchObject({ preset: "focus", columns: 3, maxWidth: 860, verticalAlign: "center", cardStyle: "glass" });
    expect(work).toMatchObject({ preset: "work", columns: 4, maxWidth: 1240, verticalAlign: "start", cardStyle: "solid" });
    expect(focus.widgets.find(widget => widget.id === "search")?.columns).toBe(3); expect(work.widgets.find(widget => widget.id === "downloads")?.columns).toBe(4);
    expect(focus.widgets.filter(widget => widget.visible).map(widget => widget.id)).not.toEqual(work.widgets.filter(widget => widget.visible).map(widget => widget.id));
  });

  it("defines a distinct composition for every named preset", () => {
    const signatures = Object.values(HOME_PRESET_COMPOSITIONS).map(preset => JSON.stringify([preset.columns, preset.gap, preset.maxWidth, preset.verticalAlign, preset.cardStyle, preset.visible, preset.spans]));
    expect(new Set(signatures).size).toBe(5);
  });
});
