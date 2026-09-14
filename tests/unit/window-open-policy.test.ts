import { describe, expect, it } from "vitest";
import {
  decideWindowOpen,
  isAuthenticationPopupUrl,
  isSafeWebPopupUrl,
} from "../../apps/desktop/electron/browser/window-open-policy.js";

describe("window open policy", () => {
  it("keeps ordinary target blank navigation in Moon tabs", () => {
    expect(decideWindowOpen("https://example.com/", "foreground-tab")).toEqual({ action: "tab", active: true });
    expect(decideWindowOpen("https://example.com/", "background-tab")).toEqual({ action: "tab", active: false });
  });

  it("preserves opener semantics for OAuth even when Chromium reports default", () => {
    for (const url of [
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=moon",
      "https://example-idp.test/authorize?client_id=moon&redirect_uri=https%3A%2F%2Fpinterest.com",
      "https://auth.pinterest.com/login/",
    ]) {
      expect(isAuthenticationPopupUrl(url)).toBe(true);
      expect(decideWindowOpen(url, "default")).toEqual({ action: "popup" });
    }
    expect(decideWindowOpen("about:blank", "default", { features: "width=500,height=700" })).toEqual({ action: "popup" });
  });

  it("keeps explicit new windows as sandboxed popups", () => {
    expect(decideWindowOpen("https://example.com/login", "new-window")).toEqual({ action: "popup" });
    expect(decideWindowOpen("about:blank", "new-window")).toEqual({ action: "popup" });
  });

  it("blocks privileged, credential-bearing and malformed popup URLs", () => {
    for (const url of ["javascript:alert(1)", "file:///tmp/token", "data:text/html,unsafe", "https://user:secret@example.com/", "not a url"]) {
      expect(isSafeWebPopupUrl(url)).toBe(false);
      expect(decideWindowOpen(url, "new-window")).toEqual({ action: "deny" });
    }
  });
});
