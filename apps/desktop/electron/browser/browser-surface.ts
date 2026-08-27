import { WebContentsView, type BaseWindow } from "electron";

export class ElectronBrowserSurface {
  readonly view: WebContentsView;
  #destroyed = false;

  constructor(
    readonly id: string,
    readonly tabId: string,
    readonly window: BaseWindow,
    options: Electron.WebContentsViewConstructorOptions = {}
  ) {
    this.view = new WebContentsView(options);
    this.window.contentView.addChildView(this.view);
    this.view.setVisible(false);
  }

  setBounds(bounds: Electron.Rectangle): void {
    if (!this.#destroyed) this.view.setBounds(bounds);
  }

  setVisible(visible: boolean): void {
    if (!this.#destroyed) this.view.setVisible(visible);
  }

  focus(): void {
    if (!this.#destroyed) this.view.webContents.focus();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.window.contentView.removeChildView(this.view);
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
  }
}
