// The dependency requests /master/ at runtime. Pin each ruleset to a reviewed
// Git commit so a branch update cannot silently change the filtering engine.
export const GHOSTERY_RULES_COMMIT = "6f0610bf5eec1f31c4975ce0e707cdf47023e5b5";
const PREFIX = "/ghostery/adblocker/master/packages/adblocker/assets/";

export function pinnedGhosteryRulesUrl(input: string): string {
  const url = new URL(input);
  if (url.origin !== "https://raw.githubusercontent.com" || !url.pathname.startsWith(PREFIX) ||
      url.search || url.hash || !/^\/[a-z0-9-]+\/[a-z0-9-]+\.(?:txt|json)$/i.test(url.pathname.slice(PREFIX.length - 1))) {
    throw new Error("Unrecognized Ghostery rules URL");
  }
  return `https://raw.githubusercontent.com/ghostery/adblocker/${GHOSTERY_RULES_COMMIT}/packages/adblocker/assets/${url.pathname.slice(PREFIX.length)}`;
}
