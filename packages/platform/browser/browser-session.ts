export interface BrowserSessionOptions {
  readonly id: string;
  readonly persistent: boolean;
  readonly private: boolean;
  readonly proxyId?: string;
}
export interface BrowserSessionData {
  readonly cookies: number;
  readonly cacheBytes: number;
  readonly storageBytes: number;
}
export type BrowserSessionDataType = "cookies" | "cache" | "storage";
export interface BrowserSessionAdapter {
  create(options: BrowserSessionOptions): Promise<void>;
  clear(id: string, data?: readonly BrowserSessionDataType[]): Promise<void>;
  destroy(id: string): Promise<void>;
  inspect(id: string): Promise<BrowserSessionData>;
}

export class BrowserSessionService {
  readonly #sessions = new Map<string, BrowserSessionOptions>();
  constructor(readonly adapter: BrowserSessionAdapter) {}
  async create(options: BrowserSessionOptions): Promise<void> {
    if (this.#sessions.has(options.id)) throw new Error(`Browser session already exists: ${options.id}`);
    if (options.private && options.persistent) throw new Error("Private browser sessions cannot be persistent");
    await this.adapter.create(options);
    this.#sessions.set(options.id, options);
  }
  get(id: string): BrowserSessionOptions | undefined { return this.#sessions.get(id); }
  list(): readonly BrowserSessionOptions[] { return [...this.#sessions.values()]; }
  clear(id: string, data?: readonly BrowserSessionDataType[]) { this.#require(id); return this.adapter.clear(id, data); }
  inspect(id: string) { this.#require(id); return this.adapter.inspect(id); }
  async destroy(id: string): Promise<void> { this.#require(id); await this.adapter.destroy(id); this.#sessions.delete(id); }
  #require(id: string): void { if (!this.#sessions.has(id)) throw new Error(`Browser session not found: ${id}`); }
}
