// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { ResourcesPanel } from "../../ui/resources/resources-panel.js";
import type { ResourceSnapshot } from "../../packages/ipc/resource-contract.js";
const sample: ResourceSnapshot = {memoryComplete: true, cpuComplete: true, sampledAt: 1000, processes: [], processCount: 2, memoryKiB: 4096, cpuPercent: 15, activeTabs: 1, tabs: [
  {id: "a", title: "<img src=x onerror=alert(1)>", active: true, pid: 10, sharedTabs: 2, memoryKiB: 2048, cpuPercent: null}
], ai: {state: "not-running", memoryKiB: null, cpuPercent: null}};
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); });
it("renders measured values, shared-process warnings and titles as text", async () => {
  const panel = new ResourcesPanel(async () => sample, {visible: () => false, change: vi.fn()});
  const host = document.createElement("div"); document.body.append(host); panel.mount(host); await settle();
  expect(host.textContent).toContain("4.0 MiB"); expect(host.textContent).toContain("15.0%");
  expect(host.textContent).toContain("Compartilhado por 2 abas"); expect(host.textContent).toContain("<img"); expect(host.querySelector("img")).toBeNull();
  expect(host.textContent).toContain("nenhum processo de modelo ativo"); panel.unmount();
});
it("polls only while mounted and does not overlap requests", async () => {
  vi.useFakeTimers(); const query = vi.fn(async () => sample); const panel = new ResourcesPanel(query, {visible: () => false, change: vi.fn()});
  panel.mount(document.createElement("div")); await settle(); expect(query).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4000); expect(query).toHaveBeenCalledTimes(3);
  panel.unmount(); await vi.advanceTimersByTimeAsync(6000); expect(query).toHaveBeenCalledTimes(3);
});
it("reports failed measurements without fabricating zero consumption", async () => {
  const panel = new ResourcesPanel(async () => { throw new Error("unavailable"); }, {visible: () => false, change: vi.fn()});
  const host = document.createElement("div"); document.body.append(host); panel.mount(host); await settle();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Não foi possível"); expect(host.textContent).not.toContain("0.0 MiB"); panel.unmount();
});
it("lets the user opt into the sidebar button", async () => {
  const change = vi.fn(); const panel = new ResourcesPanel(async () => sample, {visible: () => false, change});
  const host = document.createElement("div"); document.body.append(host); panel.mount(host); await settle();
  host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); expect(change).toHaveBeenCalledWith(true); panel.unmount();
});
