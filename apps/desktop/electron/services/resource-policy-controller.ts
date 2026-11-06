// Nexus Inc. — opt-in policy, native review and cancellation owned by main.
import { dialog } from "electron";
import type { ResourceSettings, ResourcePolicyState, ResourceEconomyReport } from "../../../../packages/ipc/resource-policy-contract.js";
import { DEFAULT_RESOURCE_SETTINGS, parseResourceSettings } from "../../../../packages/ipc/resource-policy-contract.js";
import type { WindowManager } from "../main/window-manager.js";
import type { LocalProfileManager } from "./local-profile-manager.js";
import type { ProfileAccessService } from "./profile-access.js";
import type { ResourceMonitor } from "./resource-monitor.js";
import { TabLifecycleService } from "./tab-lifecycle-service.js";
export class ResourcePolicyController {
  readonly #settings = new Map<string, {settings: ResourceSettings; warning?: string}>();
  readonly #versions = new Map<string, number>();
  readonly #updatingProfiles = new Set<string>();
  readonly #busy = new Set<string>();
  readonly #pending = new Set<Promise<unknown>>();
  readonly #watchedWindows = new Set<string>();
  readonly #dialogs = new Map<string, AbortController>();
  readonly #unsubscribe: readonly (() => void)[];
  #timer: ReturnType<typeof setTimeout> | undefined;
  #stopped = false;
  constructor(readonly lifecycle: TabLifecycleService, readonly monitor: ResourceMonitor, readonly windows: WindowManager,
    readonly profiles: LocalProfileManager, readonly access: ProfileAccessService) {
    this.#unsubscribe = [access.onLock(id => {
      for (const windowId of lifecycle.browser.windowIds()) if (windows.profileId(windowId) === id) this.cancel(windowId);
    }), lifecycle.browser.onTabUpdated(windowId => {
      if (this.#stopped || windows.isPrivate(windowId) || windows.isGuest(windowId)) return;
      const cached = this.#settings.get(windows.profileId(windowId));
      if (!cached || cached.settings.automatic) this.#schedule();
    })];
  }
  #schedule(): void {
    if (this.#stopped || this.#timer) return;
    this.#timer = setTimeout(() => { this.#timer = undefined; const work = this.#automatic(); this.#pending.add(work); void work.finally(() => this.#pending.delete(work)); }, 10_000);
    this.#timer.unref();
  }
  #assert(windowId: string, version: number): void {
    if (this.#stopped || this.#versions.get(windowId) !== version || !this.windows.get(windowId)) throw new Error("Operação de recursos cancelada.");
    this.access.assertUnlocked(this.windows.profileId(windowId));
  }
  async #load(profileId: string): Promise<{settings: ResourceSettings; warning?: string}> {
    const cached = this.#settings.get(profileId); if (cached) return cached;
    let result: {settings: ResourceSettings; warning?: string};
    const storage = this.profiles.openedStorage(profileId);
    try { result = {settings: await storage.loadResourceSettings()}; }
    catch { result = {settings: {...DEFAULT_RESOURCE_SETTINGS}, warning: "Política indisponível ou inválida. Economia automática desativada; salve as opções para recriar a configuração."}; }
    this.#settings.set(profileId, result); return result;
  }
  cancel(windowId: string): void { this.#versions.set(windowId, (this.#versions.get(windowId) ?? 0) + 1); this.#dialogs.get(windowId)?.abort(); }
  stop(): void {
    this.#stopped = true; clearTimeout(this.#timer); this.#timer = undefined;
    for (const controller of this.#dialogs.values()) controller.abort();
    this.#unsubscribe.forEach(unsubscribe => unsubscribe()); this.lifecycle.dispose();
  }
  async drain(): Promise<void> { await Promise.allSettled([...this.#pending]); }
  async #run<T>(windowId: string, action: (assert: () => void) => Promise<T>): Promise<T> {
    if (this.#busy.has(windowId)) throw new Error("Aguarde a avaliação em andamento ou escolha Parar.");
    const version = this.#versions.get(windowId) ?? 0; this.#versions.set(windowId, version);
    const assert = () => this.#assert(windowId, version); assert(); this.#busy.add(windowId);
    if (!this.#watchedWindows.has(windowId)) {
      this.#watchedWindows.add(windowId);
      this.windows.require(windowId).once("closed", () => { this.cancel(windowId); this.#versions.delete(windowId); this.#dialogs.delete(windowId); this.#watchedWindows.delete(windowId); });
    }
    const work = action(assert); this.#pending.add(work);
    try { return await work; } finally { this.#pending.delete(work); this.#busy.delete(windowId); }
  }
  async state(windowId: string, inspect = false): Promise<ResourcePolicyState> {
    return this.#run(windowId, async assert => {
      const state = await this.#load(this.windows.profileId(windowId)); assert();
      const candidates = inspect ? await this.lifecycle.inspect(windowId, state.settings, true, assert) : [];
      // Activity tokens and native navigation/pageState never cross IPC.
      return {...state, canConfigure: !this.windows.isPrivate(windowId) && !this.windows.isGuest(windowId), candidates: candidates.map(candidate => ({id: candidate.id, title: candidate.title.slice(0, 500), url: this.#origin(candidate.url), eligible: candidate.eligible, reasons: candidate.reasons, suspended: candidate.suspended}))};
    });
  }
  #origin(value: string): string { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.origin : ""; } catch { return ""; } }
  async configure(windowId: string, value: unknown): Promise<ResourcePolicyState> {
    if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) throw new Error("Configure a economia em uma janela normal do perfil.");
    if (this.#busy.has(windowId)) throw new Error("Aguarde a avaliação em andamento ou escolha Parar.");
    const clean = parseResourceSettings(value); const profileId = this.windows.profileId(windowId);
    this.access.assertUnlocked(profileId);
    if (this.#updatingProfiles.has(profileId)) throw new Error("Aguarde a configuração em andamento neste perfil.");
    this.#updatingProfiles.add(profileId);
    for (const id of this.lifecycle.browser.windowIds()) if (this.windows.profileId(id) === profileId) this.cancel(id);
    try { return await this.#run(windowId, async assert => {
      const previous = await this.#load(profileId); assert();
      const expanded = clean.reloadSafeOrigins.filter(origin => !clean.exceptions.includes(origin)).some(origin => !previous.settings.reloadSafeOrigins.includes(origin) || previous.settings.exceptions.includes(origin));
      if (clean.automatic && (!previous.settings.automatic || expanded)) {
        const abort = new AbortController(); this.#dialogs.set(windowId, abort);
        try {
          const response = await dialog.showMessageBox(this.windows.require(windowId), {signal: abort.signal, type: "warning", title: "Autorizar economia automática", message: "Permitir recarregar páginas estáticas nos sites declarados?", detail: "Declare somente sites cujas páginas você considera seguras para recarga. O Moon preserva abas ativas, privadas, com scripts, campos, mídia ou atividade detectada. O alvo de RAM não é um limite garantido. Não há homologação universal de sites dinâmicos.\n\nOrigens autorizadas:\n" + (clean.reloadSafeOrigins.join("\n") || "Nenhuma; não haverá suspensão automática até autorizar um site."), buttons: ["Cancelar", "Autorizar e salvar"], defaultId: 0, cancelId: 0});
          if (response.response !== 1) return {...previous, canConfigure: true, candidates: [], warning: "Configuração cancelada. As opções anteriores foram preservadas."};
        } finally { this.#dialogs.delete(windowId); }
      }
      assert(); await this.profiles.openedStorage(profileId).saveResourceSettings(clean); assert();
      this.#settings.set(profileId, {settings: clean}); if (clean.automatic) this.#schedule();
      return {settings: clean, canConfigure: true, candidates: []};
    }); } finally { this.#updatingProfiles.delete(profileId); }
  }
  async economize(windowId: string, requested = true): Promise<ResourceEconomyReport> {
    return this.#run(windowId, async assert => {
      if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) throw new Error("A economia não suspende janelas privadas ou temporárias.");
      const {settings} = await this.#load(this.windows.profileId(windowId)); assert();
      const before = this.monitor.freshSnapshot(windowId);
      if (!requested && (!settings.automatic || (settings.targetMiB !== null && (before.memoryKiB === null || before.memoryKiB <= settings.targetMiB * 1024)))) return {cancelled: false, suspendedIds: [], beforeKiB: before.memoryKiB, afterKiB: before.memoryKiB, skipped: []};
      const candidates = await this.lifecycle.inspect(windowId, settings, requested, assert); assert();
      const eligible = candidates.filter(candidate => candidate.eligible); const limit = requested ? 50 : 5;
      const suspendedIds: string[] = []; const skipped = candidates.filter(candidate => !candidate.eligible).map(candidate => ({id: candidate.id, reasons: candidate.reasons}));
      if (requested && eligible.length) {
        const abort = new AbortController(); this.#dialogs.set(windowId, abort);
        try {
          const response = await dialog.showMessageBox(this.windows.require(windowId), {signal: abort.signal, type: "question", title: "Suspender páginas estáticas", message: `Suspender até ${Math.min(limit, eligible.length)} aba(s) elegível(is)?`, detail: "As superfícies serão destruídas. Ao reativar, o Moon recarrega a página na mesma partição e restaura o histórico e a rolagem em memória. Somente sites que você declarou seguros para recarga são elegíveis. Abas com atividade ou conteúdo complexo são preservadas.\n\n" + eligible.slice(0, 20).map(candidate => `${candidate.title.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").slice(0, 120)} — ${this.#origin(candidate.url)}`).join("\n"), buttons: ["Cancelar", "Suspender"], defaultId: 0, cancelId: 0});
          if (response.response !== 1) return {cancelled: true, suspendedIds, skipped, beforeKiB: before.memoryKiB, afterKiB: this.monitor.freshSnapshot(windowId).memoryKiB};
        } finally { this.#dialogs.delete(windowId); }
      }
      for (const candidate of eligible.slice(0, limit)) {
        assert();
        try { await this.lifecycle.suspend(windowId, candidate, assert); suspendedIds.push(candidate.id); }
        catch (error) { assert(); skipped.push({id: candidate.id, reasons: [error instanceof Error ? error.message : "A aba foi preservada."]}); }
        if (!requested && settings.targetMiB !== null) {
          const current = this.monitor.freshSnapshot(windowId).memoryKiB;
          if (current !== null && current <= settings.targetMiB * 1024) break;
        }
      }
      return {cancelled: false, suspendedIds, skipped, beforeKiB: before.memoryKiB, afterKiB: this.monitor.freshSnapshot(windowId).memoryKiB};
    });
  }
  async #automatic(): Promise<void> {
    let again = false;
    for (const windowId of this.lifecycle.browser.windowIds()) {
      if (this.#stopped) break;
      if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) continue;
      try {
        this.access.assertUnlocked(this.windows.profileId(windowId));
        if (this.#updatingProfiles.has(this.windows.profileId(windowId))) continue;
        const {settings} = await this.#load(this.windows.profileId(windowId));
        if (!settings.automatic) continue;
        again = true; if (!this.#busy.has(windowId)) await this.economize(windowId, false);
      } catch { /* A locked, changed or closing profile is never force-suspended. */ }
    }
    if (again) this.#schedule();
  }
}
