// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { IconRegistry } from "../../ui/browser-shell/icon-registry.js";

describe("IconRegistry", () => {
  it("installs a sanitized local override and refreshes mounted icons", () => {
    const registry = new IconRegistry({ moon: '<path d="M1 1h2"/>' }); const node = registry.create("moon"); document.body.append(node);
    registry.install({ moon: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8"/></svg>' });
    expect(node.querySelector("circle")?.getAttribute("r")).toBe("8");
  });

  it("rejects active content atomically and keeps the builtin fallback", () => {
    const registry = new IconRegistry({ moon: '<path d="M1 1h2"/>' }); const node = registry.create("moon"); document.body.append(node);
    expect(() => registry.install({ moon: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" onclick="alert(1)"/></svg>' })).toThrow(/atributo/i);
    expect(node.querySelector("path")).not.toBeNull(); expect(node.querySelector("script")).toBeNull();
  });
});
