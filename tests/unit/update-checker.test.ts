import { afterEach, describe, expect, it, vi } from "vitest";
import { selectUpdate, UpdateChecker } from "../../apps/desktop/electron/services/update-checker.js";
const release = (tag: string, url = `https://github.com/heitgh/Moon-browser/releases/tag/${tag}`) => ({ tag_name: tag, html_url: url, body: "Novidades", draft: false, published_at: "2030-01-01T00:00:00Z" });
afterEach(() => vi.unstubAllGlobals());
describe("advisory update checker", () => {
  it("selects versions numerically and respects stable, beta and alpha channels", () => {
    const releases = [release("v0.6.0-alpha.10"), release("v0.6.0-beta.1"), release("v0.6.0"), release("v0.7.0-alpha.1")];
    expect(selectUpdate("0.6.0-alpha.3", releases)?.version).toBe("v0.7.0-alpha.1");
    expect(selectUpdate("0.6.0-beta.1", releases)?.version).toBe("v0.6.0");
    expect(selectUpdate("0.6.0", releases)).toBeNull();
    expect(selectUpdate("0.6.0-alpha.9", [release("v0.6.0-alpha.10")])?.version).toBe("v0.6.0-alpha.10");
  });
  it("rejects foreign, credentialed, non-HTTPS and draft download links", () => {
    for (const url of ["https://evil.test/x", "http://github.com/heitgh/Moon-browser/releases/tag/v1.0.0", "https://github.com/other/repo/releases/tag/v1.0.0", "https://user@github.com/heitgh/Moon-browser/releases/tag/v1.0.0"]) expect(selectUpdate("0.6.0", [release("v1.0.0", url)])).toBeNull();
    expect(selectUpdate("0.6.0", [{ ...release("v1.0.0"), draft: true }])).toBeNull();
  });
  it("never offers the historical v1.0.0 or releases older than the installed release", () => {
    expect(selectUpdate("0.6.0-alpha.4", [{ ...release("v1.0.0"), published_at: "2026-08-10T16:39:08Z" }])).toBeNull();
    expect(selectUpdate("0.6.0-alpha.4", [
      { ...release("v0.6.0-alpha.4"), published_at: "2030-01-02T00:00:00Z" },
      { ...release("v0.7.0"), published_at: "2030-01-01T00:00:00Z" }
    ])).toBeNull();
    expect(selectUpdate("0.6.0-alpha.4", [{ ...release("v0.7.0"), published_at: "invalid" }])).toBeNull();
  });
  it("coalesces concurrent checks and recovers after network failure", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response(JSON.stringify([release("v1.0.0")]))); vi.stubGlobal("fetch", fetcher);
    const checker = new UpdateChecker("0.6.0"); const first = checker.check(); expect(checker.check()).toBe(first);
    await expect(first).rejects.toThrow("offline"); expect(checker.available).toBeNull();
    expect((await checker.check())?.version).toBe("v1.0.0"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
