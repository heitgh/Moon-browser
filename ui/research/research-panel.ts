import { renderMarkdown } from "../notes/moon-notes-panel.js";
import { button, element } from "../browser-shell/dom.js";
import type { MoonBrowserBridge, Tab } from "../browser-shell/contracts.js";
import { emptyMemory, localResearch, MEMORY_CATEGORIES, type MemoryCategory, type MemoryItem, type ResearchMemory, type ResearchMode, type ResearchResult } from "../../packages/research/research.js";

const categoryLabels: Record<MemoryCategory, string> = { preferences: "Preferências", projects: "Projetos", pages: "Páginas salvas", notes: "Notas", sessions: "Sessões" };
interface PanelOptions {
  readonly bridge: MoonBrowserBridge | undefined;
  readonly context: () => { workspaceId: string; private: boolean; tabs: readonly Tab[] };
  readonly saveNote: (title: string, markdown: string, url?: string) => Promise<boolean>;
}
export class ResearchPanel {
  readonly element = element("section", "moon-research");
  #scope = "";
  #memory = emptyMemory();
  #result: ResearchResult | undefined;
  #generation = 0;
  #memoryView = false;
  #busy = false;
  #status = element("p", "moon-research-status");
  #query = "";
  #tabsKey = "";
  #mode: ResearchMode = "short";
  constructor(readonly options: PanelOptions) { this.#status.setAttribute("role", "status"); }

  mount(container: HTMLElement): void {
    container.append(this.element);
    const context = this.options.context();
    if (context.private) { this.element.replaceChildren(element("p", "moon-info-card", "Pesquisa e memória estão desativadas em janelas privadas e de convidado.")); return; }
    if (this.#scope !== context.workspaceId) {
      this.#scope = context.workspaceId; this.#generation += 1; this.#memory = emptyMemory(); this.#result = undefined; this.#memoryView = false; this.#busy = false; this.#draw();
      const scope = this.#scope;
      void this.options.bridge?.loadResearchMemory?.(scope).then(memory => { if (this.#scope === scope) { this.#memory = memory; this.#draw(); } }).catch(() => this.#message("Não foi possível ler a memória. Os dados existentes foram preservados."));
    } else {
      const tabsKey = context.tabs.map(t => `${t.id}:${t.url}:${t.title}`).join("|");
      if (!this.#busy && tabsKey !== this.#tabsKey && !this.#memoryView) { this.#tabsKey = tabsKey; this.#draw(); }
    }
  }
  #message(text: string): void { this.#status.textContent = text; }
  #control(label: string, action: () => void): HTMLButtonElement { const control = button("moon-secondary-button", label); control.append(element("span", "", label)); control.addEventListener("click", action); return control; }
  #draw(): void {
    this.element.replaceChildren();
    const intro = element("p", "moon-drawer-description", "Leia, organize e retome suas fontes. Processamento local; nenhum conteúdo é enviado a serviços externos.");
    const unavailable = element("p", "moon-info-card", "IA generativa indisponível: nenhum provedor configurado. O modo local seleciona trechos e cria roteiros de revisão, sem inventar respostas.");
    const tabs = element("div", "moon-research-actions");
    tabs.append(this.#control("Pesquisar e estudar", () => { this.#memoryView = false; this.#draw(); }), this.#control("O que o Moon lembra sobre mim?", () => { this.#memoryView = true; this.#draw(); }));
    this.element.append(intro, unavailable, tabs);
    if (this.#memoryView) this.#drawMemory(); else this.#drawResearch();
    this.element.append(this.#status);
    this.element.setAttribute("aria-busy", String(this.#busy));
  }
  #drawResearch(): void {
    const selection = element("fieldset", "moon-research-sources"); selection.append(element("legend", "", "1. Escolha até cinco abas deste workspace"));
    const eligible = this.options.context().tabs.filter(tab => !tab.private && (tab.workspaceId ?? "research") === this.#scope && /^https?:/.test(tab.url));
    const chosen = new Set<string>();
    eligible.forEach(tab => { const label = element("label"); const check = element("input"); check.type = "checkbox"; check.value = tab.id; check.checked = tab.active; if (check.checked) chosen.add(tab.id); check.addEventListener("change", () => { if (check.checked) chosen.add(tab.id); else chosen.delete(tab.id); }); label.append(check, element("span", "", `${tab.title || tab.url} — ${tab.url}`)); selection.append(label); });
    if (!eligible.length) selection.append(element("p", "", "Abra uma página web para começar. PDFs e páginas sensíveis ainda não são aceitos."));
    const consentLabel = element("label", "moon-research-consent"); const consent = element("input"); consent.type = "checkbox"; consentLabel.append(consent, element("span", "", "Autorizo a leitura local destas abas e confirmei que não contêm dados sensíveis."));
    const mode = element("select", "moon-select"); mode.setAttribute("aria-label", "Formato da pesquisa");
    const modes: [ResearchMode, string][] = [["short", "Trechos principais"], ["detailed", "Leitura detalhada"], ["question", "Buscar trechos por pergunta"], ["flashcards", "Cartões de revisão"], ["checklist", "Roteiro de estudo"], ["compare", "Comparar fontes"]];
    modes.forEach(([value, label]) => { const option = element("option", "", label); option.value = value; mode.append(option); }); mode.value = this.#mode; mode.addEventListener("change", () => { this.#mode = mode.value as ResearchMode; });
    const query = element("input", "moon-settings-input"); query.maxLength = 1000; query.placeholder = "Pergunta ou termos para localizar nas fontes"; query.setAttribute("aria-label", "Pergunta sobre as fontes"); query.value = this.#query; query.addEventListener("input", () => { this.#query = query.value; });
    const read = this.#control("Ler fontes selecionadas", () => {
      if (!consent.checked || !chosen.size || chosen.size > 5) { this.#message("Selecione de uma a cinco abas e autorize a leitura local."); return; }
      const scope = this.#scope; const generation = ++this.#generation; const requestedMode = this.#mode; const requestedQuery = this.#query;
      void this.#run(async () => {
        const sources = await this.options.bridge?.captureResearch?.(scope, [...chosen], true);
        if (generation !== this.#generation || scope !== this.#scope) return;
        if (!sources) throw new Error("A leitura exige o aplicativo desktop atualizado.");
        this.#result = localResearch(sources, requestedMode, requestedQuery); this.#message("Leitura concluída. As fontes estão apenas neste painel até você salvar."); this.#draw();
      });
    }); read.disabled = this.#busy;
    const cancel = this.#control("Cancelar leitura", () => { this.#generation += 1; this.#busy = false; this.#message("Leitura cancelada; nenhum resultado será guardado."); this.#draw(); });
    if (this.#result) {
      const controls = element("details"); controls.append(element("summary", "", "Alterar fontes e formato"), selection, consentLabel, mode, query, read, cancel); this.element.append(controls);
    } else this.element.append(selection, consentLabel, mode, query, read, cancel);
    if (!this.#result) return;
    const output = element("textarea", "moon-research-output"); output.rows = 16; output.readOnly = true; output.value = this.#result.markdown; output.setAttribute("aria-label", "Resultado com fontes em Markdown");
    const actions = element("div", "moon-research-actions");
    actions.append(this.#control("Salvar como nota", () => void this.#run(async () => { const result = this.#result!; const saved = await this.options.saveNote(result.title, result.markdown, result.sources[0]?.url); this.#message(saved ? "Nota salva no perfil, com referências. Encontre-a em Notas ou na Central de comandos." : "Não foi possível salvar a nota."); })), this.#control("Exportar Markdown", () => void this.#run(async () => { await this.options.bridge?.exportResearch?.(this.#result!.markdown); })), this.#control("Copiar resultado", () => void this.#run(async () => { await navigator.clipboard.writeText(this.#result!.markdown); this.#message("Resultado copiado."); })), this.#control("Esquecer leitura atual", () => { this.#result = undefined; this.#generation += 1; this.#draw(); }));
    const preview = element("div", "moon-notes-preview"); renderMarkdown(preview, this.#result.markdown, () => undefined);
    const raw = element("details"); raw.append(element("summary", "", "Ver Markdown"), output);
    this.element.append(preview, raw, actions);
  }
  #drawMemory(): void {
    this.element.append(element("p", "moon-drawer-description", "Memória opcional, apenas deste perfil e workspace. Nada é memorizado automaticamente. Salve somente conteúdo não sensível. Desativar uma categoria interrompe novas gravações; use Esquecer para apagar itens existentes."));
    const permissions = element("fieldset", "moon-research-sources"); permissions.append(element("legend", "", "Categorias permitidas"));
    for (const category of MEMORY_CATEGORIES) {
      const label = element("label"); const check = element("input"); check.type = "checkbox"; check.checked = this.#memory.enabled.includes(category); check.disabled = this.#busy;
      check.addEventListener("change", () => void this.#run(async () => { await this.#saveMemory({ ...this.#memory, enabled: check.checked ? [...this.#memory.enabled, category] : this.#memory.enabled.filter(c => c !== category) }); this.#draw(); })); label.append(check, element("span", "", categoryLabels[category])); permissions.append(label);
    }
    const ttl = element("select", "moon-select"); ttl.setAttribute("aria-label", "Expiração de novas lembranças"); [7, 30, 90].forEach(days => { const option = element("option", "", `${days} dias`); option.value = String(days); ttl.append(option); }); ttl.value = String(this.#memory.retentionDays); ttl.addEventListener("change", () => void this.#run(async () => { await this.#saveMemory({ ...this.#memory, retentionDays: Number(ttl.value) }); }));
    const title = element("input", "moon-settings-input"); title.maxLength = 200; title.placeholder = "Nome da lembrança ou sessão"; title.setAttribute("aria-label", "Nome da lembrança");
    const text = element("textarea", "moon-research-output"); text.rows = 4; text.placeholder = "Preferência, projeto ou anotação que você quer guardar"; text.setAttribute("aria-label", "Conteúdo da lembrança"); text.maxLength = 30_000;
    const category = element("select", "moon-select"); category.setAttribute("aria-label", "Categoria da lembrança"); MEMORY_CATEGORIES.forEach(c => { const option = element("option", "", categoryLabels[c]); option.value = c; category.append(option); });
    const save = this.#control("Guardar lembrança", () => void this.#run(async () => {
      const kind = category.value as MemoryCategory;
      if (!this.#memory.enabled.includes(kind)) throw new Error("Ative a categoria antes de guardar.");
      if (!title.value.trim()) throw new Error("Dê um nome à lembrança.");
      const scope = this.#scope;
      const urls = kind === "sessions" ? await this.options.bridge?.researchSessionUrls?.(scope) ?? [] : kind === "pages" ? this.#result?.sources.map(s => s.url) ?? [] : [];
      if (scope !== this.#scope) return;
      if ((kind === "sessions" || kind === "pages") && !urls.length) throw new Error("Não há páginas elegíveis. Leia fontes ou abra abas não sensíveis neste workspace.");
      const now = Date.now(); const markdown = text.value || (kind === "pages" ? this.#result?.markdown ?? "" : "");
      await this.#saveMemory({ ...this.#memory, items: [...this.#memory.items, { id: `memory-${crypto.randomUUID()}`, category: kind, title: title.value.trim(), markdown, urls, createdAt: now, expiresAt: now + this.#memory.retentionDays * 86400_000 }] }); this.#message("Lembrança salva localmente."); this.#draw();
    }));
    this.element.append(permissions, ttl, title, category, text, save);
    const actions = element("div", "moon-research-actions");
    actions.append(this.#control("Exportar memória", () => void this.#run(async () => { await this.options.bridge?.exportResearch?.(this.#memory.items.map(item => `# ${item.title}\n\nCategoria: ${categoryLabels[item.category]}\nExpira: ${new Date(item.expiresAt).toISOString()}\n\n${item.markdown}\n\n${item.urls.join("\n")}`).join("\n\n---\n\n")); })), this.#control("Apagar toda a memória deste workspace", () => { if (confirm("Apagar todas as lembranças deste workspace? Notas exportadas e backups existentes permanecem separados.")) void this.#run(async () => { await this.#saveMemory({ ...this.#memory, items: [] }); this.#draw(); }); }));
    this.element.append(actions);
    for (const kind of MEMORY_CATEGORIES) {
      const items = this.#memory.items.filter(i => i.category === kind && i.expiresAt > Date.now()); if (!items.length) continue;
      this.element.append(element("h3", "", categoryLabels[kind]), this.#control(`Apagar categoria ${categoryLabels[kind]}`, () => { if (confirm(`Apagar ${items.length} lembranças desta categoria?`)) void this.#run(async () => { await this.#saveMemory({ ...this.#memory, items: this.#memory.items.filter(i => i.category !== kind) }); this.#draw(); }); }));
      items.forEach(item => this.#drawItem(item));
    }
    if (!this.#memory.items.length) this.element.append(element("p", "", "O Moon ainda não guarda lembranças neste workspace."));
  }
  #drawItem(item: MemoryItem): void {
    const card = element("details", "moon-research-memory-item"); card.append(element("summary", "", `${item.title} · expira ${new Date(item.expiresAt).toLocaleDateString("pt-BR")}`));
    const title = element("input", "moon-settings-input"); title.value = item.title; title.maxLength = 200; title.setAttribute("aria-label", `Editar título ${item.title}`);
    const content = element("textarea", "moon-research-output"); content.value = item.markdown; content.rows = 5; content.maxLength = 30_000; content.setAttribute("aria-label", `Editar lembrança ${item.title}`);
    card.append(title, content, this.#control(`Salvar alterações de ${item.title}`, () => void this.#run(async () => { await this.#saveMemory({ ...this.#memory, items: this.#memory.items.map(i => i.id === item.id ? { ...i, title: title.value, markdown: content.value } : i) }); this.#draw(); })), this.#control(`Esquecer ${item.title}`, () => void this.#run(async () => { await this.#saveMemory({ ...this.#memory, items: this.#memory.items.filter(i => i.id !== item.id) }); this.#draw(); })));
    const selected = new Set(item.urls);
    item.urls.forEach(url => { const label = element("label", "moon-research-consent"); const check = element("input"); check.type = "checkbox"; check.checked = true; check.addEventListener("change", () => { if (check.checked) selected.add(url); else selected.delete(url); }); label.append(check, element("span", "", url)); card.append(label); });
    if (item.category === "sessions") card.append(this.#control(`Retomar ${item.title}`, () => void this.#run(async () => { const count = await this.options.bridge?.restoreResearchSession?.(this.#scope, item.id, [...selected]); this.#message(`${count ?? 0} abas restauradas. Abas já abertas foram preservadas sem duplicação.`); })));
    this.element.append(card);
  }
  async #saveMemory(value: ResearchMemory): Promise<void> {
    const scope = this.#scope; const saved = await this.options.bridge?.saveResearchMemory?.(scope, value);
    if (!saved) throw new Error("Armazenamento indisponível.");
    if (this.#scope === scope) this.#memory = saved;
  }
  async #run(action: () => Promise<void>): Promise<void> {
    if (this.#busy) { this.#message("Aguarde a operação atual."); return; }
    this.#busy = true; this.element.setAttribute("aria-busy", "true"); this.#message("Processando localmente…");
    try { await action(); } catch (error) { this.#message(error instanceof Error ? error.message : "A operação não pôde ser concluída."); }
    finally { this.#busy = false; this.element.setAttribute("aria-busy", "false"); this.element.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[disabled]').forEach(button => { button.disabled = false; }); }
  }
}
