// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { ResourcePolicyPanel, type ResourcePolicyClient } from "../../ui/resources/resource-policy-panel.js";
import { DEFAULT_RESOURCE_SETTINGS, type ResourcePolicyState } from "../../packages/ipc/resource-policy-contract.js";
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
afterEach(() => document.body.replaceChildren());
async function fixture(canConfigure = true) {
  const state: ResourcePolicyState = {settings: {...DEFAULT_RESOURCE_SETTINGS}, canConfigure, candidates: []};
  const client: ResourcePolicyClient = {load: vi.fn(async () => state), inspect: vi.fn(async () => state), save: vi.fn(async settings => ({...state, settings})), economize: vi.fn(async () => ({cancelled: false, suspendedIds: [], beforeKiB: 4000, afterKiB: null, skipped: []})), cancel: vi.fn(async () => true), restore: vi.fn(async () => undefined)};
  const panel = new ResourcePolicyPanel(client); document.body.append(panel.element); panel.mount(); await settle();
  const field = (name: string) => panel.element.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[aria-label="${name}"]`)!;
  const click = async (name: string) => { [...panel.element.querySelectorAll("button")].find(node => node.textContent === name)!.click(); await settle(); };
  return {state, client, panel, field, click};
}
it("saves a real economy preset with origins and exceptions", async () => {
  const {client, panel, field, click} = await fixture();
  field("Modo de desempenho").value = "economy"; field("Modo de desempenho").dispatchEvent(new Event("change"));
  field("Sites seguros para recarga (uma origem por linha)").value = "https://example.com\n\nhttps://other.example";
  field("Exceções de suspensão (uma origem por linha)").value = "https://other.example";
  await click("Salvar economia");
  expect(client.save).toHaveBeenCalledWith(expect.objectContaining({mode: "economy", automatic: true, idleMinutes: 5, targetMiB: 2048, reloadSafeOrigins: ["https://example.com", "https://other.example"], exceptions: ["https://other.example"]})); panel.unmount();
});
it("disables mutation controls in private or temporary windows", async () => {
  const {client, panel, click} = await fixture(false);
  await click("Salvar economia"); await click("Economizar agora"); expect(client.save).not.toHaveBeenCalled(); expect(client.economize).not.toHaveBeenCalled(); panel.unmount();
});
it("renders untrusted page titles as text and never promises unavailable memory as zero", async () => {
  const {state, panel, client, click} = await fixture();
  const inspected: ResourcePolicyState = {...state, candidates: [{id: "tab", title: "<img src=x onerror=alert(1)>", url: "https://example.com", eligible: false, reasons: ["Formulário."], suspended: false}]};
  vi.mocked(client.inspect).mockResolvedValue(inspected); await click("Avaliar abas");
  expect(panel.element.querySelector("img")).toBeNull(); expect(panel.element.textContent).toContain("<img");
  await click("Economizar agora"); expect(panel.element.querySelector('[role="status"]')?.textContent).toContain("depois: indisponível"); panel.unmount();
});
it("cancels a pending request on close and reloads instead of rendering a stale response after reopening", async () => {
  const {panel, client, state, click} = await fixture(); let resolve!: (state: ResourcePolicyState) => void;
  vi.mocked(client.inspect).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await click("Avaliar abas"); panel.unmount(); panel.mount();
  expect(client.cancel).toHaveBeenCalled(); resolve({...state, warning: "stale-warning"}); await settle();
  expect(panel.element.textContent).not.toContain("stale-warning"); expect(client.load).toHaveBeenCalledTimes(2);
  expect([...panel.element.querySelectorAll("button")].find(button => button.textContent === "Avaliar abas")!.disabled).toBe(false); panel.unmount();
});
