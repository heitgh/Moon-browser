import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { builtinSiteIcon } from "../../ui/browser-shell/site-icons.js";
it("uses bundled icons offline and never matches impersonating hosts", () => {
  for (const site of ["https://youtube.com", "https://www.youtube.com", "https://github.com"]) expect(existsSync(builtinSiteIcon(site)!)).toBe(true);
  for (const site of ["https://github.com.evil.test", "https://youtube.com@evil.test", "data:text/html,x"]) expect(builtinSiteIcon(site)).toBeUndefined();
});
