// Nexus Inc. — no automatic suspension without explicit safe scope and activity proof.
import { expect, it } from "vitest";
import { DEFAULT_RESOURCE_SETTINGS, parseResourceSettings, type PageActivity } from "../../packages/ipc/resource-policy-contract.js";
import { ResourcePolicy } from "../../apps/desktop/electron/services/resource-policy.js";
const policy = new ResourcePolicy();
const settings = {...DEFAULT_RESOURCE_SETTINGS, mode: "economy" as const, automatic: true, idleMinutes: 5, targetMiB: 1024, reloadSafeOrigins: ["https://example.com"]};
const tab = {url: "https://example.com/read", active: false, private: false, loading: false};
const activity: PageActivity = {documentId: "1-2-3-4", url: tab.url, eligible: true, reasons: [], scrollX: 0, scrollY: 100};
it("requires a valid origin allowlist, optional target and bounded idle time", () => {
  expect(parseResourceSettings(settings)).toEqual(settings);
  for (const value of [{...settings, targetMiB: 1}, {...settings, idleMinutes: 0}, {...settings, reloadSafeOrigins: ["https://example.com/path"]}, {...settings, exceptions: ["https://user:password@example.com"]}, {...settings, mode: "hard-limit"}]) expect(() => parseResourceSettings(value)).toThrow();
});
it("preserves active, private, loading and unverified pages even on a manual economy request", () => {
  for (const unsafe of [{...tab, active: true}, {...tab, private: true}, {...tab, loading: true}]) expect(policy.evaluate(settings, unsafe, activity, 600_000, true).length).toBeGreaterThan(0);
  expect(policy.evaluate(settings, tab, null, 600_000, true)).toContain("Não foi possível verificar a atividade da página.");
});
it("never suspends scripts, forms or other stateful pages even when the site is authorized", () => {
  expect(policy.evaluate(settings, tab, {...activity, eligible: false, reasons: ["Formulário em preenchimento."]}, 600_000, true)).toContain("Formulário em preenchimento.");
});
it("makes exceptions stronger than the explicit reload-safe origin declaration", () => {
  expect(policy.evaluate({...settings, exceptions: ["https://example.com"]}, tab, activity, 600_000, true)).toContain("Site incluído nas exceções.");
  expect(policy.evaluate(settings, {...tab, url: "https://other.example/read"}, activity, 600_000, true).length).toBeGreaterThan(0);
});
it("enforces automatic idle time while a user request may reclaim a safe background page sooner", () => {
  expect(policy.evaluate(settings, tab, activity, 1000, false).length).toBeGreaterThan(0);
  expect(policy.evaluate(settings, tab, activity, 1000, true)).toEqual([]);
  expect(policy.evaluate(settings, tab, activity, 600_000, false)).toEqual([]);
  expect(policy.evaluate({...settings, automatic: false}, tab, activity, 600_000, false).length).toBeGreaterThan(0);
});
it("refuses stale documents, unknown idle duration and inconsistent activity", () => {
  expect(policy.evaluate(settings, tab, {...activity, url: "https://example.com/changed"}, 600_000, true).length).toBeGreaterThan(0);
  expect(policy.evaluate(settings, tab, activity, NaN, false).length).toBeGreaterThan(0);
  expect(policy.evaluate(settings, tab, {...activity, eligible: false, reasons: []}, 600_000, true).length).toBeGreaterThan(0);
});
it("canonicalizes an origin without silently accepting paths, wildcards or incorrect mode types", () => {
  expect(parseResourceSettings({...settings, reloadSafeOrigins: ["https://EXAMPLE.com/"]}).reloadSafeOrigins).toEqual(["https://example.com"]);
  expect(() => parseResourceSettings({...settings, mode: ["economy"]})).toThrow();
  expect(() => parseResourceSettings({...settings, reloadSafeOrigins: ["https://*.example.com"]})).toThrow();
});
