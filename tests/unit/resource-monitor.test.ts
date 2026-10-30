// Nexus Inc. — unique processes, initial CPU sample and window boundaries.
import { expect, it, vi } from "vitest";
import { ResourceMonitor, type RawProcessMetric } from "../../apps/desktop/electron/services/resource-monitor.js";
const processMetric = (pid: number, memory = 1024, creationTime = 1): RawProcessMetric => ({pid, creationTime, type: "Tab", memory: {workingSetSize: memory}, cpu: {percentCPUUsage: 7}});
it("counts a process once and labels the full shared process for each tab", () => {
  const monitor = new ResourceMonitor(() => [processMetric(1), processMetric(1), processMetric(2, 2048)], () => [
    {id: "a", windowId: "first", title: "A", active: true, pid: 1}, {id: "b", windowId: "second", title: "Private title", active: true, pid: 1}
  ]);
  const sample = monitor.snapshot("first");
  expect(sample.processCount).toBe(2); expect(sample.memoryKiB).toBe(3072);
  expect(sample.tabs).toEqual([{id: "a", title: "A", active: true, pid: 1, sharedTabs: 2, memoryKiB: 1024, cpuPercent: null}]);
  expect(JSON.stringify(sample)).not.toContain("Private title");
});
it("does not present the first CPU sample as idle and caches sampling across windows", () => {
  let now = 1000; const metrics = vi.fn(() => [processMetric(1)]);
  const monitor = new ResourceMonitor(metrics, () => [], () => now);
  expect(monitor.snapshot("first").cpuPercent).toBeNull();
  monitor.snapshot("second"); expect(metrics).toHaveBeenCalledTimes(1);
  now += 2000; expect(monitor.snapshot("first").cpuPercent).toBe(7);
});
it("treats PID reuse as a new process instead of reusing its CPU baseline", () => {
  let now = 1000; let created = 1;
  const monitor = new ResourceMonitor(() => [processMetric(7, 1024, created)], () => [], () => now);
  monitor.snapshot("window"); now += 2000; expect(monitor.snapshot("window").cpuPercent).toBe(7);
  created = 2; now += 2000; expect(monitor.snapshot("window").cpuPercent).toBeNull();
});
it("shows unavailable metrics explicitly and rejects invalid process identifiers", () => {
  const monitor = new ResourceMonitor(() => [{pid: 3, creationTime: 1, type: "Tab", memory: {workingSetSize: NaN}}, processMetric(-1)], () => [
    {id: "unloaded", windowId: "window", title: "Unavailable", active: false, pid: null}
  ]);
  const sample = monitor.snapshot("window");
  expect(sample.processCount).toBe(1); expect(sample.memoryKiB).toBeNull(); expect(sample.cpuPercent).toBeNull();
  expect(sample.tabs[0]).toMatchObject({pid: null, memoryKiB: null, cpuPercent: null});
  expect(sample.ai).toEqual({state: "not-running", memoryKiB: null, cpuPercent: null});
});
it("attributes AI only to explicitly registered measured processes", () => {
  const monitor = new ResourceMonitor(() => [processMetric(1), processMetric(2, 4096)], () => [], Date.now, () => new Set([2]));
  expect(monitor.snapshot("window").ai).toMatchObject({state: "running", memoryKiB: 4096});
});
it("sorts heavy pages without adding their shared memory to the total twice", () => {
  const monitor = new ResourceMonitor(() => [processMetric(1), processMetric(2, 4096)], () => [
    {id: "light", title: "Light", active: false, windowId: "window", pid: 1},
    {id: "heavy", title: "Heavy", active: true, windowId: "window", pid: 2},
    {id: "shared", title: "Shared", active: false, windowId: "window", pid: 2}
  ]);
  const sample = monitor.snapshot("window");
  expect(sample.tabs[0]!.id).toBe("heavy"); expect(sample.memoryKiB).toBe(5120); expect(sample.activeTabs).toBe(1);
});
it("reports partial sums without turning unavailable processes into measured zeros", () => {
  let now = 1000;
  const monitor = new ResourceMonitor(() => [processMetric(1), {pid: 2, creationTime: 1, type: "Utility", memory: {workingSetSize: NaN}, cpu: {percentCPUUsage: Infinity}}], () => [], () => now);
  expect(monitor.snapshot("window")).toMatchObject({memoryKiB: 1024, memoryComplete: false, cpuPercent: null, cpuComplete: false});
  now += 2000;
  expect(monitor.snapshot("window")).toMatchObject({memoryKiB: 1024, memoryComplete: false, cpuPercent: 7, cpuComplete: false});
});
