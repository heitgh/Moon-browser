// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { FaviconCache } from "../../ui/browser-shell/favicon-cache.js";

const PNG = "data:image/png;base64,YQ==";

describe("FaviconCache", () => {
  beforeEach(() => localStorage.clear());

  it("stores only safe HTTPS image results and reuses them", () => {
    const cache = new FaviconCache(localStorage, () => 100); cache.configure({ enabled: true, persist: true, ttlDays: 30 });
    expect(cache.set("https://moon.test/favicon.png", PNG)).toBe(true); expect(cache.get("https://moon.test/favicon.png")).toBe(PNG);
    expect(cache.set("http://moon.test/favicon.png", PNG)).toBe(false); expect(cache.set("https://moon.test/vector.svg", "data:image/svg+xml;base64,YQ==")).toBe(false);
  });

  it("expires entries and removes persistent data in private cache mode", () => {
    let now = 100; const cache = new FaviconCache(localStorage, () => now); cache.configure({ enabled: true, persist: true, ttlDays: 1 });
    cache.set("https://moon.test/favicon.png", PNG); now += 86_400_001; expect(cache.get("https://moon.test/favicon.png")).toBeUndefined();
    cache.set("https://moon.test/favicon.png", PNG); cache.configure({ enabled: true, persist: false, ttlDays: 1 }); expect(localStorage.getItem("moon:favicons:v1")).toBeNull(); expect(cache.get("https://moon.test/favicon.png")).toBe(PNG);
  });

  it("disables lookup without deleting the cache", () => {
    const cache = new FaviconCache(localStorage); cache.set("https://moon.test/favicon.png", PNG); cache.configure({ enabled: false, persist: true, ttlDays: 30 }); expect(cache.get("https://moon.test/favicon.png")).toBeUndefined();
  });
});
