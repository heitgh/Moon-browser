// Nexus Inc. — update the entire Electron bundle, never replace Chromium DLLs in isolation.
import updaterPackage from "electron-updater";
import type { AppUpdater } from "electron-updater";
import type { AvailableUpdate } from "./update-checker.js";
import type { NativeUpdateState } from "../../../../packages/ipc/native-update-contract.js";

export function updateFeed(update: AvailableUpdate): { url: string; channel: string } {
  const tag = update.version;
  if (!/^v?\d+\.\d+\.\d+(?:-(?:alpha|beta)\.\d+)?$/.test(tag) || update.url !== `https://github.com/heitgh/Moon-browser/releases/tag/${tag}`) throw new Error("Invalid official update");
  return { url: `https://github.com/heitgh/Moon-browser/releases/download/${tag}/`, channel: tag.includes("-alpha.") ? "alpha" : tag.includes("-beta.") ? "beta" : "latest" };
}

export class NativeUpdater {
  #updater: AppUpdater | undefined;
  #busy = false;
  #state: NativeUpdateState;
  constructor(
    readonly runtime: { packaged: boolean; platform: string; portable: boolean; appImage: boolean; moon: string; chromium: string; electron: string },
    readonly emit: (state: NativeUpdateState) => void,
    readonly factory: (url: string, channel: string) => AppUpdater = (url, channel) => runtime.platform === "win32"
      ? new updaterPackage.NsisUpdater({ provider: "generic", url, channel })
      : new updaterPackage.AppImageUpdater({ provider: "generic", url, channel })
  ) {
    this.#state = { phase: "idle", supported: runtime.packaged && ((runtime.platform === "win32" && !runtime.portable) || (runtime.platform === "linux" && runtime.appImage)), moon: runtime.moon, chromium: runtime.chromium, electron: runtime.electron };
  }
  get state(): NativeUpdateState { return this.#state; }
  async download(update: AvailableUpdate): Promise<void> {
    if (!this.#state.supported) throw new Error("Use o instalador oficial para este formato do Moon.");
    if (this.#busy || this.#state.phase === "downloaded" || this.#state.phase === "installing") throw new Error("Já existe uma atualização em andamento.");
    const feed = updateFeed(update);
    this.#busy = true;
    this.#set({ phase: "checking", version: update.version, percent: undefined, message: "Conferindo pacote oficial…" });
    try {
      this.#updater?.removeAllListeners();
      const updater = this.factory(feed.url, feed.channel); this.#updater = updater;
      updater.autoDownload = false; updater.autoInstallOnAppQuit = false; updater.allowPrerelease = true; updater.allowDowngrade = false;
      updater.disableDifferentialDownload = true;
      updater.on("error", () => { this.#set({ phase: "error", message: "A atualização falhou. Tente novamente ou use a página oficial." }); });
      updater.on("download-progress", progress => this.#set({ phase: "downloading", percent: Math.max(0, Math.min(100, progress.percent)), message: "Baixando Moon e Chromium…" }));
      const result = await updater.checkForUpdates();
      if (!result || result.updateInfo.version.replace(/^v/, "") !== update.version.replace(/^v/, "")) throw new Error("O pacote não corresponde à versão conferida.");
      this.#set({ phase: "downloading", percent: 0, message: "Baixando Moon e Chromium…" });
      await updater.downloadUpdate();
      this.#set({ phase: "downloaded", percent: 100, message: "Pacote verificado. Salve seu trabalho antes de instalar." });
    } catch {
      this.#set({ phase: "error", message: "Não foi possível baixar e verificar a atualização. Tente novamente ou abra a página oficial." });
      throw new Error(this.#state.message);
    } finally { this.#busy = false; }
  }
  install(): void {
    if (this.#busy || this.#state.phase !== "downloaded" || !this.#updater) throw new Error("Nenhuma atualização verificada está pronta.");
    this.#set({ phase: "installing", message: "Abrindo instalador e encerrando o Moon…" });
    this.#updater.quitAndInstall(false, true);
  }
  #set(patch: Partial<NativeUpdateState>): void { this.#state = { ...this.#state, ...patch }; this.emit(this.#state); }
}
