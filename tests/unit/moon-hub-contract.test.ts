import { describe, expect, it } from "vitest";
import { moonHubInternalPreviewRoute, parseMoonHubThemeIntent } from "../../packages/hub/moon-hub-contract.js";

const now = 1_000_000;
const valid = { format: "moon-hub-theme-intent", version: 1, action: "preview", intentId: "intent-12345678", packageId: "theme.moon.product", packageVersion: "1.2.3", sha256: "a".repeat(64), signatureKeyId: "official-key-01", expiresAt: now + 60_000 };

describe("Moon Hub contract", () => {
  it("accepts only short-lived metadata-only theme preview intents", () => {
    expect(parseMoonHubThemeIntent(valid, now)).toEqual(valid);
    expect(moonHubInternalPreviewRoute(valid.intentId)).toBe("moon://themes/preview/intent-12345678");
  });
  it("rejects URLs, executable fields, unknown keys and expired intents", () => {
    expect(() => parseMoonHubThemeIntent({ ...valid, downloadUrl: "https://evil.test/theme" }, now)).toThrow(/campos desconhecidos/i);
    expect(() => parseMoonHubThemeIntent({ ...valid, script: "alert(1)" }, now)).toThrow();
    expect(() => parseMoonHubThemeIntent({ ...valid, expiresAt: now }, now)).toThrow(/expirado/i);
    expect(() => parseMoonHubThemeIntent({ ...valid, sha256: "bad" }, now)).toThrow(/hash/i);
  });
});
