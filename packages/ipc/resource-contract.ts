// Nexus Inc. — resource samples contain measurements, never browsing history.
export interface ResourceProcess {
  readonly pid: number; readonly creationTime: number; readonly type: string;
  readonly memoryKiB: number | null; readonly cpuPercent: number | null;
}
export interface ResourceTab {
  readonly id: string; readonly title: string; readonly active: boolean;
  readonly pid: number | null; readonly sharedTabs: number;
  readonly memoryKiB: number | null; readonly cpuPercent: number | null;
}
export interface ResourceSnapshot {
  readonly sampledAt: number; readonly processes: readonly ResourceProcess[];
  readonly memoryComplete: boolean; readonly cpuComplete: boolean;
  readonly processCount: number; readonly memoryKiB: number | null; readonly cpuPercent: number | null;
  readonly tabs: readonly ResourceTab[]; readonly activeTabs: number;
  readonly ai: {readonly state: "not-running" | "running"; readonly memoryKiB: number | null; readonly cpuPercent: number | null};
}
