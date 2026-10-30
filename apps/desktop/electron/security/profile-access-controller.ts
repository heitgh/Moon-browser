// Nexus Inc. — isolated access window and profile-wide locking lifecycle.
import { app, BrowserWindow, dialog, ipcMain, powerMonitor, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { ProfileAccessService } from "../services/profile-access.js";
import type { WindowManager } from "../main/window-manager.js";
import type { BrowserApplicationService } from "../../application/browser-application-service.js";
import type { IpcRouter } from "../ipc/ipc-router.js";

export class ProfileAccessError extends Error {}
interface Gate { window: BrowserWindow; promise: Promise<void>; resolve(): void; reject(error: Error): void; }
export class ProfileAccessController {
  readonly #gates = new Map<string, Gate>();
  readonly #pending = new Set<Promise<void>>();
  #quitting = false;
  readonly #timer: ReturnType<typeof setInterval>;
  constructor(readonly service: ProfileAccessService, readonly windows: WindowManager,
    readonly application: () => BrowserApplicationService | undefined,
    readonly openProfile: (id: string) => Promise<void>) {
    ipcMain.handle("access:unlock", async (event, value: unknown) => {
      const entry = [...this.#gates.entries()].find(([, gate]) => gate.window.webContents === event.sender);
      const expected = pathToFileURL(join(app.getAppPath(), "access.html")).href;
      if (!entry || event.sender.isDestroyed() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame
        || event.senderFrame.detached || event.senderFrame.url !== expected || event.sender.getURL() !== expected) throw new Error("Janela de acesso inválida.");
      const valid = await this.service.unlock(entry[0], value);
      if (valid) {
        if (this.#gates.get(entry[0]) !== entry[1] || event.sender.isDestroyed()) {
          this.service.beginLock(entry[0]); this.service.finishLock(entry[0]);
          throw new ProfileAccessError("Janela de acesso encerrada.");
        }
        entry[1].resolve();
      }
      return valid;
    });
    this.#timer = setInterval(() => {
      let idle: number;
      try { idle = powerMonitor.getSystemIdleTime(); } catch { return; }
      for (const id of this.#openProfileIds()) {
        const state = this.service.status(id);
        if (state.enabled && !state.locked && state.idleMinutes > 0 && idle >= state.idleMinutes * 60) this.lock(id);
      }
    }, 5000);
    this.#timer.unref();
    powerMonitor.on("lock-screen", () => {
      for (const id of this.#openProfileIds()) if (this.service.status(id).lockOnSystem) this.lock(id);
    });
    app.on("before-quit", () => { this.#quitting = true; });
    app.once("will-quit", () => clearInterval(this.#timer));
  }
  async authorizeStorage(id: string): Promise<void> {
    try {
      await this.service.load(id);
      try { this.service.assertLoadAllowed(id); }
      catch { await this.#waitForUnlock(id); }
    } catch (error) { throw new ProfileAccessError(error instanceof Error ? error.message : "Não foi possível autorizar o perfil."); }
  }
  authorizeShell(event: IpcMainInvokeEvent, channel: string): void {
    // The lock command returns only acknowledgement while its source is hidden.
    if (channel === "profile-access:lock") return;
    if (channel === "browser:window-action" && event.sender.isDestroyed()) return;
    const id = this.windows.idForWebContents(event.sender);
    if (!id) throw new Error("Janela indisponível.");
    this.service.assertUnlocked(this.windows.profileId(id));
  }
  register(router: IpcRouter): void {
    const profileFor = (event: IpcMainInvokeEvent): string => {
      const id = this.windows.idForWebContents(event.sender);
      if (!id || this.windows.isPrivate(id) || this.windows.isGuest(id)) throw new Error("Use uma janela normal para configurar a segurança do perfil.");
      return this.windows.profileId(id);
    };
    router.register("profile-access:status", event => this.service.status(profileFor(event)));
    router.register("profile-access:enable", async (event, payload: {password?: unknown}) => {
      const id = profileFor(event);
      const confirm = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender)!, {
        type: "warning", title: "Ativar proteção do perfil", message: "Guarde esta senha: não há recuperação de senha nesta versão.",
        detail: "Esquecer a senha impede abrir este perfil pelo Moon. A proteção impede acesso casual pelo aplicativo, mas não criptografa os arquivos. Use também uma conta protegida no computador.",
        buttons: ["Cancelar", "Entendi, ativar proteção"], defaultId: 0, cancelId: 0
      });
      if (confirm.response !== 1) return false;
      await this.service.enable(id, payload?.password); return true;
    });
    router.register("profile-access:change", (event, payload: {current?: unknown; next?: unknown}) => this.service.change(profileFor(event), payload?.current, payload?.next));
    router.register("profile-access:disable", (event, payload: {current?: unknown}) => this.service.disable(profileFor(event), payload?.current));
    router.register("profile-access:configure", (event, payload: {current?: unknown; idleMinutes?: unknown; lockOnSystem?: unknown}) => this.service.configure(profileFor(event), payload?.current, payload?.idleMinutes, payload?.lockOnSystem));
    router.register("profile-access:lock", event => { this.lock(profileFor(event)); return true; });
  }
  closeGate(id: string): void {
    const gate = this.#gates.get(id);
    if (gate && !gate.window.isDestroyed()) gate.window.destroy();
  }
  closeGates(): void { for (const id of this.#gates.keys()) this.closeGate(id); }
  focusGate(): boolean {
    const gate = [...this.#gates.values()][0];
    if (!gate) return false;
    gate.window.show(); gate.window.focus(); return true;
  }
  async drain(): Promise<void> { await Promise.allSettled([...this.#pending]); }
  lock(id: string): void {
    if (!this.service.beginLock(id)) throw new Error("Ative a proteção antes de bloquear o perfil.");
    const hosts = this.windows.list().filter(window => {
      const windowId = this.windows.idForWebContents(window.webContents);
      return windowId && this.windows.profileId(windowId) === id;
    });
    for (const window of hosts) window.hide();
    // Keep an isolated gate alive before destroying the last browser window.
    const unlocked = this.#waitForUnlock(id);
    void unlocked.catch(() => undefined);
    const work = (async () => {
      try {
        for (const window of hosts) {
          const windowId = this.windows.idForWebContents(window.webContents);
          if (windowId) await this.application()?.closeWindow(windowId);
          if (!window.isDestroyed()) window.destroy();
        }
      } catch {
        // Retain the hidden window if persistence failed, so unlocking can
        // recover its in-memory state instead of silently discarding it.
        const gate = this.#gates.get(id);
        if (gate) {
          const notice = () => { if (!gate.window.isDestroyed()) gate.window.webContents.send("access:notice", "Não foi possível salvar a sessão. Sua janela foi preservada e será retomada após desbloquear."); };
          if (gate.window.webContents.isLoading()) gate.window.webContents.once("did-finish-load", notice); else notice();
        }
      } finally {
        this.service.finishLock(id);
        void unlocked.then(async () => {
          const retained = hosts.filter(window => !window.isDestroyed());
          if (retained.length) { retained.forEach(window => window.show()); this.closeGate(id); }
          else await this.openProfile(id);
        }).catch(() => undefined);
      }
    })();
    this.#pending.add(work);
    void work.finally(() => this.#pending.delete(work));
  }
  #waitForUnlock(id: string): Promise<void> {
    const existing = this.#gates.get(id);
    if (existing) { existing.window.show(); existing.window.focus(); return existing.promise; }
    const window = new BrowserWindow({width: 560, height: 520, minWidth: 400, minHeight: 420,
      title: "Moon — Perfil bloqueado", backgroundColor: "#10121a", autoHideMenuBar: true,
      webPreferences: {nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false,
        partition: `access:${randomUUID()}`, preload: join(app.getAppPath(), "access-preload.cjs")}});
    let resolve!: () => void; let reject!: (error: Error) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    this.#gates.set(id, {window, promise, resolve, reject});
    window.webContents.setWindowOpenHandler(() => ({action: "deny"}));
    window.webContents.on("will-navigate", event => event.preventDefault());
    window.on("close", event => {
      // Closing the gate must never strand a hidden, unsaved browser window.
      const retained = this.windows.list().some(host => {
        const windowId = this.windows.idForWebContents(host.webContents);
        return windowId && this.windows.profileId(windowId) === id;
      });
      if (!this.#quitting && this.service.status(id).locked && retained) { event.preventDefault(); window.focus(); }
    });
    window.once("closed", () => {
      this.#gates.delete(id);
      if (this.service.status(id).locked) reject(new ProfileAccessError("Desbloqueio cancelado."));
      if (BrowserWindow.getAllWindows().every(window => window.isDestroyed())) app.quit();
    });
    void window.loadFile(join(app.getAppPath(), "access.html")).catch(reject);
    return promise;
  }
  #openProfileIds(): readonly string[] {
    return [...new Set(this.windows.list().flatMap(window => {
      const id = this.windows.idForWebContents(window.webContents); return id ? [this.windows.profileId(id)] : [];
    }))];
  }
}
