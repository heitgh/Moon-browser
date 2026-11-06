// Nexus Inc. — controls represent a persisted, main-owned policy, never hard caps.
import type { ResourceSettings, ResourcePolicyState, ResourceEconomyReport } from "../../packages/ipc/resource-policy-contract.js";
export interface ResourcePolicyClient {
  load(): Promise<ResourcePolicyState>; inspect(): Promise<ResourcePolicyState>; save(settings: ResourceSettings): Promise<ResourcePolicyState>;
  economize(): Promise<ResourceEconomyReport>; cancel(): Promise<unknown>; restore(id: string): Promise<void>;
}
const memory = (value: number | null): string => value === null ? "indisponível" : `${(value / 1024).toFixed(1)} MiB`;
export class ResourcePolicyPanel {
  readonly element = document.createElement("section");
  readonly #body = document.createElement("div");
  readonly #status = document.createElement("p");
  readonly #cancel = document.createElement("button");
  #generation = 0;
  #busy = false;
  #mounted = false;
  readonly #disabled = new Map<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement, boolean>();
  constructor(readonly client: ResourcePolicyClient) {
    this.element.className = "moon-resource-policy"; this.#status.setAttribute("role", "status");
    this.#cancel.type = "button"; this.#cancel.className = "moon-secondary-button"; this.#cancel.textContent = "Parar avaliação ou economia"; this.#cancel.hidden = true;
    this.#cancel.addEventListener("click", () => { this.#status.textContent = "Interrompendo as próximas ações… Suspensões já concluídas podem ser retomadas pelas abas."; void client.cancel().catch(() => undefined); });
    this.element.append(this.#body, this.#status, this.#cancel);
  }
  mount(): void {
    this.#mounted = true; this.#generation++;
    if (this.#busy) { this.#body.textContent = "Aguardando o cancelamento da avaliação anterior…"; this.#disabled.clear(); return; }
    void this.#perform(async current => { const state = await this.client.load(); if (current()) { this.#render(state); this.#status.textContent = state.warning ?? ""; } });
  }
  unmount(): void { this.#mounted = false; this.#generation++; if (this.#busy) void this.client.cancel().catch(() => undefined); }
  async #perform(action: (current: () => boolean) => Promise<void>): Promise<void> {
    if (this.#busy) return; this.#busy = true; const generation = this.#generation;
    this.#disabled.forEach((_disabled, control) => { control.disabled = true; }); this.#cancel.hidden = false;
    const current = () => this.#mounted && generation === this.#generation;
    try { await action(current); }
    catch (error) { if (this.#mounted && generation === this.#generation) this.#status.textContent = error instanceof Error ? error.message : "Não foi possível alterar a economia."; }
    finally {
      this.#busy = false;
      if (current()) { this.#disabled.forEach((disabled, control) => { control.disabled = disabled; }); this.#cancel.hidden = true; }
      else if (this.#mounted) this.mount();
    }
  }
  #render(state: ResourcePolicyState): void {
    if (!this.#mounted) return;
    this.#body.replaceChildren(); this.#disabled.clear();
    const p = (text: string) => { const node = document.createElement("p"); node.textContent = text; this.#body.append(node); };
    p("O alvo de RAM não é um limite rígido. A suspensão destrói a superfície e recarrega a página ao retomar. Declare apenas sites seguros para recarga; scripts, interação, formulários e mídia mantêm a aba acordada. Após reiniciar o Moon, o mecanismo atual restaura as URLs e pode carregá-las novamente.");
    if (state.warning) p(state.warning);
    if (!state.canConfigure) p("Configure a economia em uma janela normal. Janelas privadas e temporárias não são suspensas.");
    const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(title: string, node: T): T => {
      const label = document.createElement("label"); label.textContent = title; node.setAttribute("aria-label", title); node.className = "moon-settings-input";
      const disabled = !state.canConfigure; node.disabled = disabled || this.#busy; this.#disabled.set(node, disabled); label.append(node); this.#body.append(label); return node;
    };
    const mode = field("Modo de desempenho", document.createElement("select"));
    for (const [value, title] of [["balanced", "Equilibrado"], ["economy", "Economia"], ["custom", "Personalizado"]]) { const option = document.createElement("option"); option.value = value!; option.textContent = title!; option.selected = value === state.settings.mode; mode.append(option); }
    const automatic = field("Suspensão automática de páginas estáticas autorizadas", document.createElement("input")); automatic.type = "checkbox"; automatic.checked = state.settings.automatic;
    const idle = field("Inatividade mínima da aba (minutos)", document.createElement("input")); idle.type = "number"; idle.min = "1"; idle.max = "240"; idle.value = String(state.settings.idleMinutes);
    const useTarget = field("Usar alvo de RAM", document.createElement("input")); useTarget.type = "checkbox"; useTarget.checked = state.settings.targetMiB !== null;
    const target = field("Alvo de RAM do Moon (MiB)", document.createElement("input")); target.type = "number"; target.min = "256"; target.max = "65536"; target.value = String(state.settings.targetMiB ?? 2048);
    const allowed = field("Sites seguros para recarga (uma origem por linha)", document.createElement("textarea")); allowed.rows = 3; allowed.value = state.settings.reloadSafeOrigins.join("\n");
    const exceptions = field("Exceções de suspensão (uma origem por linha)", document.createElement("textarea")); exceptions.rows = 3; exceptions.value = state.settings.exceptions.join("\n");
    p("Exemplo de origem: https://example.com. Exceções prevalecem sobre os sites autorizados. Salve as opções antes de avaliar; autorizações de automação passam por confirmação nativa.");
    mode.addEventListener("change", () => { if (mode.value === "custom") return; automatic.checked = mode.value === "economy"; idle.value = mode.value === "economy" ? "5" : "30"; useTarget.checked = mode.value === "economy"; target.value = "2048"; });
    for (const input of [automatic, idle, useTarget, target]) input.addEventListener("change", () => { mode.value = "custom"; });
    const button = (title: string, action: (current: () => boolean) => Promise<void>, configureOnly = false) => {
      const node = document.createElement("button"); node.type = "button"; node.className = "moon-secondary-button"; node.textContent = title;
      const disabled = configureOnly && !state.canConfigure; this.#disabled.set(node, disabled); node.disabled = disabled || this.#busy;
      node.addEventListener("click", () => { void this.#perform(action); }); this.#body.append(node); return node;
    };
    const lines = (value: string): string[] => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    button("Salvar economia", async current => {
      const result = await this.client.save({version: 1, mode: mode.value as ResourceSettings["mode"], automatic: automatic.checked, idleMinutes: Number(idle.value), targetMiB: useTarget.checked ? Number(target.value) : null, reloadSafeOrigins: lines(allowed.value), exceptions: lines(exceptions.value)});
      if (!current()) return;
      this.#render(result); this.#status.textContent = result.warning ?? "Política de economia salva.";
    }, true);
    button("Avaliar abas", async current => { const state = await this.client.inspect(); if (current()) { this.#render(state); this.#status.textContent = "Avaliação concluída. Confira os motivos em cada aba."; } });
    button("Economizar agora", async current => {
      const report = await this.client.economize(); if (!current()) return;
      const state = await this.client.inspect(); if (!current()) return; this.#render(state);
      this.#status.textContent = report.cancelled ? "Economia cancelada." : `${report.suspendedIds.length} aba(s) suspensa(s). RAM medida antes: ${memory(report.beforeKiB)}; depois: ${memory(report.afterKiB)}. A liberação pode aparecer nas próximas amostras; não é um limite garantido.`;
    }, true);
    for (const candidate of state.candidates) {
      const card = document.createElement("article"); card.className = "moon-list-card";
      const title = document.createElement("strong"); title.textContent = `${candidate.title}${candidate.suspended ? " · suspensa" : ""}`; card.append(title);
      const reason = document.createElement("p"); reason.textContent = candidate.eligible ? "Elegível nesta avaliação; será verificada novamente antes de suspender." : candidate.reasons.join(" "); card.append(reason); this.#body.append(card);
      if (candidate.suspended) {
        const restore = button(`Retomar ${candidate.title}`, async current => { await this.client.restore(candidate.id); if (!current()) return; const state = await this.client.inspect(); if (current()) { this.#render(state); this.#status.textContent = "Aba recarregada."; } }); card.append(restore);
      } else if (candidate.url && state.canConfigure) {
        const add = button(`Autorizar origem de ${candidate.title}`, async () => { const origins = new Set(lines(allowed.value)); origins.add(candidate.url); allowed.value = [...origins].join("\n"); this.#status.textContent = "Origem adicionada à prévia. Salve para aplicar a política; conteúdo complexo continuará protegido."; }, true); card.append(add);
      }
    }
  }
}
