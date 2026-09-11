import { describe, expect, it } from "vitest";
import {
  decideWindowOpen,
  isSafeWebPopupUrl,
} from "../../apps/desktop/electron/browser/window-open-policy.js";

describe("window open policy", () => {
  it("keeps ordinary target blank navigation in Moon tabs", () => {
    expect(decideWindowOpen("https://example.com/", "foreground-tab")).toEqual({
      action: "tab",
      active: true,
    });
    expect(decideWindowOpen("https://example.com/", "background-tab")).toEqual({
      action: "tab",
      active: false,
    });
  });

  it("preserves real popup semantics for OAuth-style windows", () => {
    expect(
      decideWindowOpen(
        "https://accounts.google.com/o/oauth2/v2/auth",
        "new-window",
      ),
    ).toEqual({ action: "popup" });
    expect(decideWindowOpen("about:blank", "new-window")).toEqual({
      action: "popup",
    });
  });

  it("blocks privileged, credential-bearing and malformed popup URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "file:///tmp/token",
      "data:text/html,unsafe",
      "https://user:secret@example.com/",
      "not a url",
    ]) {
      expect(isSafeWebPopupUrl(url)).toBe(false);
      expect(decideWindowOpen(url, "new-window")).toEqual({ action: "deny" });
    }
  });
});
