import { describe, expect, it } from "vitest";
import {
  isRecoverableRendererExit,
  navigationFailureMessage,
  sanitizeChromiumUserAgent,
  shouldBypassContentBlocking,
} from "../../apps/desktop/electron/browser/compatibility-policy.js";

describe("site compatibility policy", () => {
  it("presents a Chromium-compatible user agent without Electron branding", () => {
    expect(sanitizeChromiumUserAgent("Mozilla/5.0 Chrome/140.0.0.0 Electron/43.0.0 Safari/537.36 MoonBrowser/0.6")).toBe("Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36");
  });

  it("fails open for top-level navigation and authentication endpoints", () => {
    expect(shouldBypassContentBlocking({ url: "https://www.tiktok.com/", resourceType: "mainFrame" } as never)).toBe(true);
    expect(shouldBypassContentBlocking({ url: "https://accounts.google.com/o/oauth2/auth", resourceType: "xhr" } as never)).toBe(true);
    expect(shouldBypassContentBlocking({ url: "https://ads.example.test/tracker.js", resourceType: "script" } as never)).toBe(false);
  });

  it("limits automatic recovery to renderer failures and hides engine errors", () => {
    expect(isRecoverableRendererExit("crashed")).toBe(true);
    expect(isRecoverableRendererExit("oom")).toBe(true);
    expect(isRecoverableRendererExit("clean-exit")).toBe(false);
    expect(navigationFailureMessage(-105)).not.toMatch(/ERR_|TypeScript/i);
  });
});
