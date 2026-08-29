import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, featureEnabled, RELEASE_GATED_FEATURE_FLAGS } from "../../config/feature-flags.js";

describe("release feature gates", () => {
  it("keeps Moon Intelligence unavailable even when an override requests it", () => {
    expect(DEFAULT_FEATURE_FLAGS.ai).toBe(false);
    expect(RELEASE_GATED_FEATURE_FLAGS.has("ai")).toBe(true);
    expect(featureEnabled(DEFAULT_FEATURE_FLAGS, "ai", { ai: true })).toBe(false);
  });

  it("still resolves ordinary feature overrides", () => {
    expect(featureEnabled(DEFAULT_FEATURE_FLAGS, "experimental-ui", { "experimental-ui": true })).toBe(true);
  });
});
