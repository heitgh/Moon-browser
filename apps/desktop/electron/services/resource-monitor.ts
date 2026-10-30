// Nexus Inc. — measure only; suspension and policy belong to separate services.
import type { ResourceProcess, ResourceSnapshot } from "../../../../packages/ipc/resource-contract.js";
export interface RawProcessMetric {
  readonly pid: number; readonly creationTime: number; readonly type: string;
  readonly memory?: {readonly workingSetSize?: number}; readonly cpu?: {readonly percentCPUUsage?: number};
}
export interface ResourceTabMapping {
  readonly id: string; readonly windowId: string; readonly title: string;
  readonly active: boolean; readonly pid: number | null;
}
const measured = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
function sum(values: readonly (number | null)[]): number | null { const available = values.filter((value): value is number => value !== null); return available.length ? available.reduce((total, value) => total + value, 0) : null; }
export class ResourceMonitor {
  #previous = new Set<string>();
  #sample: {at: number; processes: readonly ResourceProcess[]} | undefined;
  constructor(readonly metrics: () => readonly RawProcessMetric[], readonly mappings: () => readonly ResourceTabMapping[],
    readonly now = Date.now, readonly aiPids: () => ReadonlySet<number> = () => new Set()) {}
  #measure(): {at: number; processes: readonly ResourceProcess[]} {
    const at = this.now();
    if (this.#sample && at >= this.#sample.at && at - this.#sample.at < 500) return this.#sample;
    const unique = new Map<number, RawProcessMetric>();
    for (const metric of this.metrics()) {
      if (!Number.isSafeInteger(metric.pid) || metric.pid <= 0 || !measured(metric.creationTime)) continue;
      const existing = unique.get(metric.pid);
      if (!existing || metric.creationTime > existing.creationTime) unique.set(metric.pid, metric);
    }
    const keys = new Set<string>();
    const processes = [...unique.values()].map(metric => {
      const key = `${metric.pid}:${metric.creationTime}`; keys.add(key);
      const memory = metric.memory?.workingSetSize; const cpu = metric.cpu?.percentCPUUsage;
      return {pid: metric.pid, creationTime: metric.creationTime, type: metric.type,
        memoryKiB: measured(memory) && memory > 0 ? memory : null,
        cpuPercent: this.#previous.has(key) && measured(cpu) ? cpu : null};
    });
    this.#previous = keys; this.#sample = {at, processes}; return this.#sample;
  }
  snapshot(windowId: string): ResourceSnapshot {
    const sample = this.#measure(); const byPid = new Map(sample.processes.map(metric => [metric.pid, metric]));
    const mappings = this.mappings(); const sharing = new Map<number, number>();
    for (const tab of mappings) if (tab.pid) sharing.set(tab.pid, (sharing.get(tab.pid) ?? 0) + 1);
    const tabs = mappings.filter(tab => tab.windowId === windowId).map(tab => {
      const metric = tab.pid ? byPid.get(tab.pid) : undefined;
      return {id: tab.id, title: tab.title.slice(0, 500), active: tab.active, pid: tab.pid,
        sharedTabs: tab.pid ? sharing.get(tab.pid) ?? 0 : 0, memoryKiB: metric?.memoryKiB ?? null, cpuPercent: metric?.cpuPercent ?? null};
    }).sort((a, b) => (b.memoryKiB ?? -1) - (a.memoryKiB ?? -1));
    const aiPids = this.aiPids();
    const ai = sample.processes.filter(metric => aiPids.has(metric.pid));
    return {memoryComplete: sample.processes.length > 0 && sample.processes.every(metric => metric.memoryKiB !== null),
      cpuComplete: sample.processes.length > 0 && sample.processes.every(metric => metric.cpuPercent !== null), sampledAt: sample.at, processes: sample.processes, processCount: sample.processes.length,
      memoryKiB: sum(sample.processes.map(metric => metric.memoryKiB)), cpuPercent: sum(sample.processes.map(metric => metric.cpuPercent)),
      tabs, activeTabs: tabs.filter(tab => tab.active).length,
      ai: {state: ai.length ? "running" : "not-running", memoryKiB: sum(ai.map(metric => metric.memoryKiB)), cpuPercent: sum(ai.map(metric => metric.cpuPercent))}};
  }
}
