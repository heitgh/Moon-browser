import { expect, it } from "vitest";
import { GHOSTERY_RULES_COMMIT, pinnedGhosteryRulesUrl } from "../../apps/desktop/electron/services/adblock-rules-source.js";

it("pins only the Ghostery rules assets used by the installed blocker", () => {
  const source = "https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/easylist/easylist.txt";
  expect(pinnedGhosteryRulesUrl(source)).toBe(`https://raw.githubusercontent.com/ghostery/adblocker/${GHOSTERY_RULES_COMMIT}/packages/adblocker/assets/easylist/easylist.txt`);
  for (const invalid of [
    "https://evil.test/ghostery/adblocker/master/packages/adblocker/assets/easylist/easylist.txt",
    `${source}?next=1`,
    "https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/../other.txt",
    "https://raw.githubusercontent.com/ghostery/adblocker/main/packages/adblocker/assets/easylist/easylist.txt"
  ]) expect(() => pinnedGhosteryRulesUrl(invalid)).toThrow();
});
