import { describe, expect, it } from "vitest";
import { permissionOrigin, permissionRequestOrigin } from "../../apps/desktop/electron/security/permission-origin.js";
describe("permission requesting origin", () => {
  it("uses the iframe URL, including after redirects", () => {
    expect(permissionRequestOrigin({ requestingUrl: "https://camera.example/frame?x=1" })).toBe("https://camera.example");
    expect(permissionRequestOrigin({ requestingUrl: "https://redirected.example/" })).toBe("https://redirected.example");
  });
  it.each([undefined, "", "null", "about:blank", "file:///moon/index.html", "data:text/html,x", "https://user:pass@example.com"])("denies missing or opaque requester %s", requestingUrl => {
    expect(permissionRequestOrigin({ requestingUrl })).toBeUndefined();
  });
  it("normalizes request and check identities identically", () => {
    expect(permissionRequestOrigin({ requestingUrl: "https://example.com:443/path" })).toBe(permissionOrigin("https://example.com"));
    expect(permissionOrigin("https://example.com:444/path")).toBe("https://example.com:444");
  });
});
