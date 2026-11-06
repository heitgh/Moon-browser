import { dialog, type BrowserWindow, type MessageBoxOptions } from "electron";

type Prompt = Pick<MessageBoxOptions, "title" | "message" | "detail"> & { readonly accept: string };

/** Each review is owned by one window and is invalidated when its profile locks. */
export class NativeConsent {
  readonly #pending = new Map<BrowserWindow, { readonly profileId: string; readonly abort: AbortController }>();
  #stopped = false;

  async confirm(window: BrowserWindow, profileId: string, prompt: Prompt, assertContext: () => void): Promise<boolean> {
    assertContext();
    if (this.#stopped || window.isDestroyed()) throw new Error("A janela está encerrando.");
    if (this.#pending.has(window)) throw new Error("Conclua a confirmação aberta antes de continuar.");

    const abort = new AbortController();
    const cancel = () => abort.abort();
    this.#pending.set(window, { profileId, abort });
    window.once("closed", cancel);
    try {
      const { response } = await dialog.showMessageBox(window, {
        signal: abort.signal,
        type: "warning",
        title: prompt.title,
        message: prompt.message,
        detail: prompt.detail,
        buttons: ["Cancelar", prompt.accept],
        defaultId: 0,
        cancelId: 0
      });
      if (abort.signal.aborted || response !== 1) return false;
      assertContext();
      return true;
    } finally {
      window.removeListener("closed", cancel);
      this.#pending.delete(window);
    }
  }

  cancelProfile(profileId: string): void {
    for (const item of this.#pending.values()) {
      if (item.profileId === profileId) item.abort.abort();
    }
  }

  stop(): void {
    this.#stopped = true;
    for (const item of this.#pending.values()) item.abort.abort();
  }
}

export function consentText(value: string, maxLength: number): string {
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").slice(0, maxLength);
}
