export type BrowserProcessType =
  | "browser"
  | "renderer"
  | "utility"
  | "gpu"
  | "extension";

export interface BrowserProcessInfo {
  readonly id: number;
  readonly type: BrowserProcessType;
  readonly name?: string;
  readonly cpuPercent?: number;
  readonly memoryBytes?: number;
  readonly startedAt: number;
}

export interface BrowserProcessMetrics {
  readonly processes: number;
  readonly cpuPercent: number;
  readonly memoryBytes: number;
}

export interface BrowserProcessController {
  list(): Promise<readonly BrowserProcessInfo[]>;
  terminate(processId: number): Promise<void>;
}

export class BrowserProcessService {
  constructor(readonly controller: BrowserProcessController) {}

  async list(type?: BrowserProcessType): Promise<readonly BrowserProcessInfo[]> {
    const processes = await this.controller.list();
    return type ? processes.filter(process => process.type === type) : processes;
  }

  async metrics(): Promise<BrowserProcessMetrics> {
    const processes = await this.list();
    return {
      processes: processes.length,
      cpuPercent: processes.reduce((sum, process) => sum + (process.cpuPercent ?? 0), 0),
      memoryBytes: processes.reduce((sum, process) => sum + (process.memoryBytes ?? 0), 0)
    };
  }

  async terminate(processId: number): Promise<void> {
    const process = (await this.list()).find(candidate => candidate.id === processId);
    if (!process) throw new Error(`Browser process not found: ${processId}`);
    if (process.type === "browser") throw new Error("The main browser process cannot be terminated through this service");
    await this.controller.terminate(processId);
  }
}
