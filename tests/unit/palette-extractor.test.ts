// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { contrast } from "../../ui/customization/customization-schema.js";
import { extractPalette } from "../../ui/customization/palette-extractor.js";

describe("local palette extraction", () => {
  it("derives deterministic semantic colors without network input", () => {
    const pixels = new Uint8ClampedArray([...Array(12).fill([8, 12, 24, 255]), ...Array(5).fill([130, 70, 245, 255]), ...Array(3).fill([32, 42, 58, 255])].flat());
    const palette = extractPalette(new ImageData(pixels, 5, 4));
    expect(palette.colors.background).toBe("#080c18"); expect(palette.colors.accent).toBe("#8246f5");
    expect(contrast(palette.colors.text, palette.colors.background)).toBeGreaterThan(4.5);
    expect(palette.regions.selection).toBe(palette.colors.accent);
  });
});
