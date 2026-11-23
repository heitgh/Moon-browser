import { expect, it, vi } from "vitest";
import { NavigationController } from "../../apps/desktop/electron/browser/navigation-controller.js";

it("loads only credential-free web URLs through the tab controller", async () => {
  const loadURL = vi.fn(async () => undefined);
  const controller = new NavigationController({ loadURL } as never);
  await controller.navigate("https://example.com/path");
  expect(loadURL).toHaveBeenCalledWith("https://example.com/path");
  for (const url of ["file:///tmp/private", "chrome://settings", "devtools://devtools", "javascript:alert(1)", "https://user:pass@example.com/", "http://[::1", "https://example.com@evil.test/"]) {
    await expect(controller.navigate(url)).rejects.toThrow("not allowed");
  }
  expect(loadURL).toHaveBeenCalledTimes(1);
});
