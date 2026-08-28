import { describe, expect, it } from "vitest";
import { MoonInternalHistory, normalizeMoonInternalUrl } from "../../packages/navigation/internal-routes.js";

describe("Moon internal settings routes", () => {
  it("normalizes only known, local and credential-free routes", () => {
    expect(normalizeMoonInternalUrl("moon://settings")).toBe("moon://settings/settings");
    expect(normalizeMoonInternalUrl("moon://settings/themes/")).toBe("moon://settings/themes");
    expect(normalizeMoonInternalUrl("moon://settings/personalize")).toBe("moon://settings/personalize");
    expect(normalizeMoonInternalUrl("about:blank")).toBe("moon://newtab");
    expect(normalizeMoonInternalUrl("moon://settings/unknown")).toBeNull();
    expect(normalizeMoonInternalUrl("moon://user:secret@settings/privacy")).toBeNull();
    expect(normalizeMoonInternalUrl("https://settings/appearance")).toBeNull();
  });

  it("supports back, forward and branch replacement without duplicate entries", () => {
    const history = new MoonInternalHistory("moon://newtab");
    history.push("moon://newtab"); expect(history.length).toBe(1);
    history.push("moon://settings/settings"); history.push("moon://settings/themes");
    expect(history.canGoBack).toBe(true); expect(history.canGoForward).toBe(false);
    expect(history.back()).toBe("moon://settings/settings");
    expect(history.back()).toBe("moon://newtab"); expect(history.back()).toBeUndefined();
    expect(history.forward()).toBe("moon://settings/settings");
    history.push("moon://settings/privacy");
    expect(history.current).toBe("moon://settings/privacy"); expect(history.canGoForward).toBe(false); expect(history.length).toBe(3);
  });
});
