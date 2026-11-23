import { describe, expect, it, vi } from "vitest";
import { denyWebviewAttachment, isWebNavigation, secureWebPreferences } from "../../apps/desktop/electron/security/web-preferences.js";

describe("Electron web contents security", () => {
  it("keeps secure options when a caller supplies weaker values", () => {
    const preferences = secureWebPreferences({
      preload: "/app/preload.cjs",
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true
    });
    expect(preferences).toMatchObject({
      preload: "/app/preload.cjs",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    });
  });

  it("denies attachment even if a webview is introduced later", () => {
    const on = vi.fn();
    denyWebviewAttachment({ on } as never);
    expect(on.mock.calls[0]?.[0]).toBe("will-attach-webview");
    const preventDefault = vi.fn();
    (on.mock.calls[0]?.[1] as (event: { preventDefault(): void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(["file:///tmp/secret", "chrome://settings", "devtools://devtools", "javascript:alert(1)", "https://user:pass@example.com", "not a url"])("rejects %s", url => {
    expect(isWebNavigation(url)).toBe(false);
  });
  it.each(["http://localhost/", "https://example.com/"])("allows %s", url => {
    expect(isWebNavigation(url)).toBe(true);
  });
});
