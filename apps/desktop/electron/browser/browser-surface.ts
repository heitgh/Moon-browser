import { WebContentsView, type BaseWindow } from "electron";

export class ElectronBrowserSurface {
  readonly view: WebContentsView;
  #destroyed = false;
  #closing: Promise<void> | undefined;

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

  destroy(): Promise<void> {
    if (this.#closing) return this.#closing;
    this.#destroyed = true;
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(this.view);
    const contents = this.view.webContents;
    this.#closing = contents.isDestroyed() ? Promise.resolve() : new Promise<void>(resolve => {
      contents.once("destroyed", resolve);
      // Closing the host window before this event can race renderer teardown.
      contents.close({ waitForBeforeUnload: false });
    });
    return this.#closing;
  }
}
