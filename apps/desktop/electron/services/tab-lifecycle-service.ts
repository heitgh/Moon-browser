// Nexus Inc. — domain orchestration; the Electron adapter owns physical surfaces.
import { performance } from "node:perf_hooks";
import type { BrowserTab, BrowserTabOptions } from "@moon/platform";
import type { PageActivity, ResourceSettings, SuspensionCandidate } from "../../../../packages/ipc/resource-policy-contract.js";
import type { ElectronBrowserManager } from "../browser/browser-manager.js";
import type { BrowserApplicationService } from "../../application/browser-application-service.js";
import { ResourcePolicy } from "./resource-policy.js";
export class TabLifecycleService {
  readonly #lastActive = new Map<string, number>();
  readonly #active = new Set<string>();
  readonly #unsubscribe: readonly (() => void)[];
  constructor(readonly browser: ElectronBrowserManager, readonly application: BrowserApplicationService, readonly policy = new ResourcePolicy(), readonly now = () => performance.now()) {
    this.#unsubscribe = [browser.onTabUpdated((_windowId, update) => {
      if (update.tab.active || this.#active.has(update.tab.id) || !this.#lastActive.has(update.tab.id)) this.#lastActive.set(update.tab.id, this.now());
      if (update.tab.active) this.#active.add(update.tab.id); else this.#active.delete(update.tab.id);
    }), browser.onTabClosed(id => { this.#lastActive.delete(id); this.#active.delete(id); })];
  }
  create(windowId: string, options: BrowserTabOptions): Promise<BrowserTab> { return this.application.createTab(windowId, options); }
  activate(id: string): Promise<void> { return this.application.activateTab(id); }
  restore(id: string): Promise<void> { return this.activate(id); }
  destroy(id: string): Promise<void> { return this.application.closeTab(id); }
  dispose(): void { this.#unsubscribe.forEach(unsubscribe => unsubscribe()); this.#lastActive.clear(); this.#active.clear(); }
  async inspect(windowId: string, settings: ResourceSettings, requested: boolean, assertAccess: () => void): Promise<readonly (SuspensionCandidate & {readonly activity?: PageActivity})[]> {
    assertAccess(); const tabs = await this.browser.getTabs(windowId); const candidates: (SuspensionCandidate & {activity?: PageActivity})[] = [];
    let inspected = 0;
    for (const tab of tabs) {
      assertAccess();
      if (!this.#lastActive.has(tab.id)) this.#lastActive.set(tab.id, this.now());
      const idleMs = this.now() - this.#lastActive.get(tab.id)!;
      let reasons = [...this.policy.precheck(settings, tab, idleMs, requested)]; let activity: PageActivity | null = null;
      if (tab.suspended) reasons = ["Aba já suspensa."];
      else if (!reasons.length) {
        if (inspected++ >= 50) reasons = ["Limite de avaliação alcançado; tente novamente para avaliar as demais abas."];
        else {
          activity = await this.browser.inspectSuspension(tab.id); assertAccess();
          if (!this.browser.ownsTab(tab.id, windowId)) throw new Error("A aba mudou de janela durante a avaliação.");
          reasons = [...this.policy.evaluate(settings, tab, activity, idleMs, requested)];
        }
      }
      candidates.push({id: tab.id, title: tab.title, url: tab.url, suspended: Boolean(tab.suspended), eligible: reasons.length === 0, reasons, ...(activity ? {activity} : {})});
    }
    return candidates;
  }
  async suspend(windowId: string, candidate: SuspensionCandidate & {readonly activity?: PageActivity}, assertAccess: () => void): Promise<void> {
    assertAccess();
    if (!candidate.eligible || !candidate.activity || !this.browser.ownsTab(candidate.id, windowId)) throw new Error("A aba não é elegível nesta janela.");
    await this.browser.suspendTab(candidate.id, candidate.activity, assertAccess); assertAccess();
    await this.application.flushWindow(windowId);
  }
}
