export interface BrowserSurfaceBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface BrowserSurfaceState {
  readonly id: string;
  readonly tabId: string;
  readonly visible: boolean;
  readonly focused: boolean;
  readonly bounds: BrowserSurfaceBounds;
}
export interface BrowserSurfaceAdapter {
  create(tabId: string, bounds: BrowserSurfaceBounds): Promise<string>;
  setBounds(id: string, bounds: BrowserSurfaceBounds): Promise<void>;
  setVisible(id: string, visible: boolean): Promise<void>;
  focus(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
}

export class BrowserSurfaceService {
  readonly #surfaces = new Map<string, BrowserSurfaceState>();
  constructor(readonly adapter: BrowserSurfaceAdapter) {}
  async create(tabId: string, bounds: BrowserSurfaceBounds): Promise<BrowserSurfaceState> {
    this.#validateBounds(bounds);
    const id = await this.adapter.create(tabId, bounds);
    const state = { id, tabId, visible: true, focused: false, bounds };
    this.#surfaces.set(id, state);
    return state;
  }
  get(id: string): BrowserSurfaceState | undefined { return this.#surfaces.get(id); }
  list(): readonly BrowserSurfaceState[] { return [...this.#surfaces.values()]; }
  async setBounds(id: string, bounds: BrowserSurfaceBounds): Promise<void> { this.#validateBounds(bounds); const state = this.#require(id); await this.adapter.setBounds(id, bounds); this.#surfaces.set(id, { ...state, bounds }); }
  async setVisible(id: string, visible: boolean): Promise<void> { const state = this.#require(id); await this.adapter.setVisible(id, visible); this.#surfaces.set(id, { ...state, visible }); }
  async focus(id: string): Promise<void> { const target = this.#require(id); await this.adapter.focus(id); for (const [surfaceId, state] of this.#surfaces) this.#surfaces.set(surfaceId, { ...state, focused: surfaceId === target.id }); }
  async destroy(id: string): Promise<void> { this.#require(id); await this.adapter.destroy(id); this.#surfaces.delete(id); }
  #require(id: string): BrowserSurfaceState { const state = this.#surfaces.get(id); if (!state) throw new Error(`Browser surface not found: ${id}`); return state; }
  #validateBounds(bounds: BrowserSurfaceBounds): void { if (bounds.width <= 0 || bounds.height <= 0) throw new Error("Browser surface dimensions must be positive"); }
}
