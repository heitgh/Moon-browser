import { button, element, icon, type IconName } from "../browser-shell/dom.js";

export type CommandCenterKind = "tab" | "history" | "bookmark" | "workspace" | "setting" | "command";
export interface CommandCenterItem { readonly id: string; readonly kind: CommandCenterKind; readonly title: string; readonly subtitle?: string; readonly keywords?: readonly string[]; readonly icon: IconName; readonly action: () => void | Promise<void>; }
export interface CommandCenterOptions { readonly items: () => readonly CommandCenterItem[]; readonly onClose: () => void; }

export class CommandCenter {
  readonly element = element("div", "moon-command-overlay");
  readonly #dialog = element("section", "moon-command-dialog");
  readonly #input = element("input", "moon-command-input");
  readonly #list = element("div", "moon-command-list");
  #results: readonly CommandCenterItem[] = [];
  #selected = 0;

  constructor(readonly options: CommandCenterOptions) {
    this.#dialog.setAttribute("role", "dialog"); this.#dialog.setAttribute("aria-modal", "true"); this.#dialog.setAttribute("aria-label", "Central de comandos");
    const search = element("div", "moon-command-search"); search.append(icon("search"), this.#input, element("kbd", "", "Esc")); this.#input.type = "search"; this.#input.placeholder = "Busque abas, histórico, favoritos, workspaces ou comandos"; this.#input.setAttribute("aria-label", "Buscar na Central de comandos"); this.#input.setAttribute("role", "combobox"); this.#input.setAttribute("aria-controls", "moon-command-results"); this.#input.setAttribute("aria-expanded", "true");
    this.#list.id = "moon-command-results"; this.#list.setAttribute("role", "listbox"); this.#dialog.append(search, this.#list); this.element.append(this.#dialog);
    this.#input.addEventListener("input", () => { this.#selected = 0; this.#render(); }); this.element.addEventListener("pointerdown", event => { if (event.target === this.element) this.close(); }); this.element.addEventListener("keydown", event => this.#key(event)); this.#render(); requestAnimationFrame(() => this.#input.focus());
  }

  close(): void { this.element.remove(); this.options.onClose(); }

  #render(): void {
    const query = normalize(this.#input.value); const terms = query.split(/\s+/).filter(Boolean); const all = this.options.items();
    this.#results = (terms.length ? all.filter(item => { const haystack = normalize([item.title, item.subtitle, item.kind, ...(item.keywords ?? [])].filter(Boolean).join(" ")); return terms.every(term => fuzzy(haystack, term)); }).sort((left, right) => score(right, terms) - score(left, terms)) : [...all].sort((left, right) => priority(left.kind) - priority(right.kind))).slice(0, 60);
    this.#selected = Math.min(this.#selected, Math.max(0, this.#results.length - 1)); this.#list.replaceChildren();
    if (!this.#results.length) { this.#list.append(element("div", "moon-command-empty", "Nenhum resultado. Você também pode pesquisar diretamente pela omnibox.")); this.#input.removeAttribute("aria-activedescendant"); return; }
    this.#results.forEach((item, index) => { const row = button(`moon-command-result${index === this.#selected ? " is-selected" : ""}`, `Executar ${item.title}`, item.icon); row.id = `moon-command-${index}`; row.setAttribute("role", "option"); row.setAttribute("aria-selected", String(index === this.#selected)); row.dataset.kind = item.kind; const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", item.title), element("small", "", item.subtitle ?? kindLabel(item.kind))); row.append(copy, element("span", "moon-command-kind", kindLabel(item.kind))); row.addEventListener("pointerenter", () => { this.#selected = index; this.#syncSelection(); }); row.addEventListener("click", () => void this.#execute(index)); this.#list.append(row); }); this.#input.setAttribute("aria-activedescendant", `moon-command-${this.#selected}`);
  }

  #key(event: KeyboardEvent): void {
    if (event.key === "Escape") { event.preventDefault(); this.close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!this.#results.length) return; this.#selected = (this.#selected + (event.key === "ArrowDown" ? 1 : -1) + this.#results.length) % this.#results.length; this.#syncSelection(); return; }
    if (event.key === "Enter") { event.preventDefault(); void this.#execute(this.#selected); }
  }
  #syncSelection(): void { this.#list.querySelectorAll<HTMLElement>(".moon-command-result").forEach((row, index) => { row.classList.toggle("is-selected", index === this.#selected); row.setAttribute("aria-selected", String(index === this.#selected)); }); this.#input.setAttribute("aria-activedescendant", `moon-command-${this.#selected}`); this.#list.children[this.#selected]?.scrollIntoView({ block: "nearest" }); }
  async #execute(index: number): Promise<void> { const item = this.#results[index]; if (!item) return; this.close(); await item.action(); }
}

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(); }
function fuzzy(haystack: string, needle: string): boolean { if (haystack.includes(needle)) return true; let cursor = 0; for (const character of haystack) if (character === needle[cursor]) cursor += 1; return cursor === needle.length; }
function score(item: CommandCenterItem, terms: readonly string[]): number { const title = normalize(item.title); const subtitle = normalize(item.subtitle ?? ""); return terms.reduce((total, term) => total + (title.startsWith(term) ? 10 : title.includes(term) ? 6 : subtitle.includes(term) ? 3 : 1), 0) + (item.kind === "tab" ? 2 : 0); }
function priority(kind: CommandCenterKind): number { return ({ command: 0, tab: 1, workspace: 2, bookmark: 3, history: 4, setting: 5 })[kind]; }
function kindLabel(kind: CommandCenterKind): string { return ({ command: "Comando", tab: "Aba", workspace: "Workspace", bookmark: "Favorito", history: "Histórico", setting: "Configuração" })[kind]; }
