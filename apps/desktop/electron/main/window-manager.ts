import { BrowserWindow, type BrowserWindowConstructorOptions, type WebContents } from "electron";

export class WindowManager {
  readonly #windows = new Map<string, BrowserWindow>();
  #nextId = 0;

  create(options: BrowserWindowConstructorOptions = {}): string {
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
    window.once("ready-to-show", () => {
      if (!window.isDestroyed()) window.show();
    });
    window.once("closed", () => this.#windows.delete(id));
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

  close(id: string): void { this.require(id).close(); }
  focus(id: string): void { this.require(id).focus(); }

  list(): readonly BrowserWindow[] {
    return [...this.#windows.values()].filter(window => !window.isDestroyed());
  }

  closeAll(): void {
    for (const window of this.list()) window.close();
  }
}
