import { BrowserWindow, type BrowserWindowConstructorOptions, type WebContents } from "electron";

export class WindowManager {
  readonly #windows = new Map<string, BrowserWindow>();
  readonly #privateWindows = new Set<string>();
  readonly #guestWindows = new Set<string>();
  readonly #profileIds = new Map<string, string>();
  #nextId = 0;

  create(options: BrowserWindowConstructorOptions = {}, context: { readonly private?: boolean; readonly guest?: boolean; readonly profileId?: string } = {}): string {
    const id = `window-${++this.#nextId}`;
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 760,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      title: "Moon Browser",
      backgroundColor: "#090a10",
      ...options
    });

    this.#windows.set(id, window);
    if (context.private) this.#privateWindows.add(id);
    if (context.guest) this.#guestWindows.add(id);
    this.#profileIds.set(id, context.profileId ?? "default");
    window.once("ready-to-show", () => {
      if (!window.isDestroyed()) window.show();
    });
    window.once("closed", () => { this.#windows.delete(id); this.#privateWindows.delete(id); this.#guestWindows.delete(id); this.#profileIds.delete(id); });
    return id;
  }

  get(id: string): BrowserWindow | undefined {
    const window = this.#windows.get(id);
    return window && !window.isDestroyed() ? window : undefined;
  }

  require(id: string): BrowserWindow {
    const window = this.get(id);
    if (!window) throw new Error(`Window not found: ${id}`);
    return window;
  }

  idForWebContents(contents: WebContents): string | undefined {
    for (const [id, window] of this.#windows) {
      if (!window.isDestroyed() && window.webContents.id === contents.id) return id;
    }
    return undefined;
  }

  isPrivate(id: string): boolean { return this.#privateWindows.has(id); }
  isGuest(id: string): boolean { return this.#guestWindows.has(id); }
  profileId(id: string): string { if (!this.#windows.has(id)) throw new Error(`Window not found: ${id}`); return this.#profileIds.get(id) ?? "default"; }
  hasProfileWindows(profileId: string, excludingWindowId?: string): boolean {
    return [...this.#windows.keys()].some(id => id !== excludingWindowId && this.#profileIds.get(id) === profileId);
  }

  close(id: string): void { this.require(id).close(); }
  focus(id: string): void { this.require(id).focus(); }

  list(): readonly BrowserWindow[] {
    return [...this.#windows.values()].filter(window => !window.isDestroyed());
  }

  closeAll(): void {
    for (const window of this.list()) window.close();
  }
}
