// Nexus Inc. — local measurements; polling exists only while the panel is mounted.
import type { ResourceSnapshot } from "../../packages/ipc/resource-contract.js";
export const RESOURCE_SIDEBAR_KEY = "moon:resources:sidebar:v1";
export const memoryLabel = (value: number | null): string => value === null ? "Indisponível" : `${(value / 1024).toFixed(1)} MiB`;
export const cpuLabel = (value: number | null): string => value === null ? "Coletando / indisponível" : `${value.toFixed(1)}%`;
export class ResourcesPanel {
  #timer: ReturnType<typeof setInterval> | undefined;
  #generation = 0;
  #pending = false;
  #container: HTMLElement | undefined;
  readonly #values = document.createElement("div");
  readonly #pages = document.createElement("div");
  readonly #status = document.createElement("p");
  constructor(readonly sample: () => Promise<ResourceSnapshot>, readonly sidebar: {visible(): boolean; change(visible: boolean): void}) {}
  mount(container: HTMLElement): void {
    this.unmount(); this.#container = container;
    const heading = (title: string) => { const node = document.createElement("h3"); node.className = "moon-panel-section-title"; node.textContent = title; return node; };
    const description = document.createElement("p"); description.className = "moon-drawer-description";
    description.textContent = "Métricas locais de todos os processos do Moon. RAM é a soma dos conjuntos de trabalho; memória compartilhada entre processos pode entrar nessa soma. CPU pode ultrapassar 100% em vários núcleos.";
    const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "moon-secondary-button"; refresh.textContent = "Atualizar recursos";
    refresh.addEventListener("click", () => { void this.refresh(); });
    this.#status.setAttribute("role", "status");
    const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = this.sidebar.visible();
    checkbox.addEventListener("change", () => this.sidebar.change(checkbox.checked)); label.append(checkbox, document.createTextNode(" Mostrar Recursos na sidebar"));
    const economy = document.createElement("p"); economy.textContent = "A suspensão de abas e os modos de economia ainda não estão implementados nesta etapa. Feche abas dispensáveis para reduzir o consumo.";
    container.replaceChildren();
    container.append(description, heading("Agora"), this.#values, refresh, this.#status, heading("Páginas pesadas desta janela"), this.#pages, heading("Economizar"), economy, label);
    void this.refresh();
    this.#timer = setInterval(() => { void this.refresh(); }, 2000);
  }
  isMounted(container: HTMLElement): boolean { return this.#container === container; }
  unmount(): void { clearInterval(this.#timer); this.#timer = undefined; this.#container = undefined; this.#generation++; }
  async refresh(): Promise<void> {
    if (!this.#container || this.#pending) return;
    const generation = this.#generation; this.#pending = true;
    try {
      const state = await this.sample();
      if (generation !== this.#generation || !this.#container) return;
      this.#values.replaceChildren(); this.#pages.replaceChildren();
      const row = (container: HTMLElement, text: string) => { const p = document.createElement("p"); p.textContent = text; container.append(p); };
      row(this.#values, `RAM dos processos: ${memoryLabel(state.memoryKiB)}${state.memoryComplete ? "" : " (parcial; há processos sem medição)"}`);
      row(this.#values, `CPU total: ${cpuLabel(state.cpuPercent)}${state.cpuComplete ? "" : " (amostra parcial)"}`);
      row(this.#values, `Processos únicos: ${state.processCount}`);
      row(this.#values, `Abas desta janela: ${state.tabs.length}; ativas: ${state.activeTabs}`);
      row(this.#values, state.ai.state === "running" ? `IA: ${memoryLabel(state.ai.memoryKiB)} · CPU ${cpuLabel(state.ai.cpuPercent)}` : "IA local: nenhum processo de modelo ativo.");
      row(this.#values, `Amostra: ${new Date(state.sampledAt).toLocaleTimeString()}`);
      if (!state.tabs.length) row(this.#pages, "Nenhuma aba nesta janela.");
      for (const tab of state.tabs) {
        const card = document.createElement("article"); card.className = "moon-list-card";
        const title = document.createElement("strong"); title.textContent = `${tab.title || "Sem título"}${tab.active ? " · ativa" : ""}`; title.style.overflowWrap = "anywhere"; card.append(title);
        row(card, `Processo ${tab.pid ?? "indisponível"} · ${memoryLabel(tab.memoryKiB)} · CPU ${cpuLabel(tab.cpuPercent)}`);
        if (tab.sharedTabs > 1) row(card, `Compartilhado por ${tab.sharedTabs} abas, incluindo outras janelas. Os valores pertencem ao processo inteiro; não some estas linhas.`);
        this.#pages.append(card);
      }
      this.#status.textContent = "";
    } catch { if (generation === this.#generation) this.#status.textContent = "Não foi possível atualizar as métricas. Os valores anteriores podem estar desatualizados. Tente novamente."; }
    finally { this.#pending = false; }
  }
}
