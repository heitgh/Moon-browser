import { describe, expect, it } from "vitest";
import { SitePermissionService } from "../../apps/desktop/electron/security/site-permission-service.js";
import { parseSitePermissionKey, parseSitePermissionRecord } from "../../packages/ipc/site-permission-contract.js";

describe("SitePermissionService", () => {
  it("hydrates, persists and revokes decisions by normalized origin", async () => {
    let stored = [parseSitePermissionRecord({ origin: "https://meet.example/path", permission: "media", decision: "deny", updatedAt: 1 })];
    const persistence = { loadSitePermissions: async () => stored, saveSitePermissions: async (records: typeof stored) => { stored = [...records]; } };
    const service = new SitePermissionService(); await service.hydrate(persistence);
    expect(service.get("https://meet.example", "media")).toBe("deny");
    await service.set("https://meet.example", "media", "allow"); expect(service.get("https://meet.example", "media")).toBe("allow");
    await service.clear("https://meet.example", "media"); expect(service.list()).toEqual([]); expect(stored).toEqual([]);
  });

  it("rejects non-web origins and malformed permissions at the shared boundary", () => {
    expect(() => parseSitePermissionKey({ origin: "file:///tmp/private", permission: "media" })).toThrow();
    expect(() => parseSitePermissionKey({ origin: "https://moon.test", permission: "../../camera" })).toThrow();
  });

  it("rolls its in-memory decision back when durable persistence fails", async () => {
    let fail = false;
    const persistence = {
      loadSitePermissions: async () => [parseSitePermissionRecord({ origin: "https://camera.example", permission: "media", decision: "deny", updatedAt: 1 })],
      saveSitePermissions: async () => { if (fail) throw new Error("disk unavailable"); }
    };
    const service = new SitePermissionService(); await service.hydrate(persistence);
    fail = true;
    await expect(service.set("https://camera.example", "media", "allow")).rejects.toThrow("disk unavailable");
    expect(service.get("https://camera.example", "media")).toBe("deny");
    await expect(service.clear("https://camera.example", "media")).rejects.toThrow("disk unavailable");
    expect(service.get("https://camera.example", "media")).toBe("deny");
  });
});
