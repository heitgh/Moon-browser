import type { ImportCategory, ImportResult, ImportSourceSummary } from "../../packages/ipc/browser-import-contract.js";
import { button, element, icon } from "../browser-shell/dom.js";
import type { Density, TabPosition, ThemeMode } from "../customization/customization-schema.js";
import { CustomizationStore } from "../customization/customization-store.js";

export const ONBOARDING_STORAGE_KEY = "moon:onboarding:v1";
const LAST_STEP = 5;

interface OnboardingChoices {
  readonly appearanceMode?: Extract<ThemeMode, "light" | "dark" | "system">;
  readonly density?: Exclude<Density, "custom">;
  readonly tabPosition?: TabPosition;
  readonly searchEngine?: string;
  readonly favicons?: boolean;
}

export interface OnboardingState {
  readonly status: "in-progress" | "completed" | "skipped";
  readonly step: number;
  readonly choices: OnboardingChoices;
}

export interface OnboardingFlowOptions {
  readonly store: CustomizationStore;
  readonly storage?: Storage;
  readonly onDiscoverImportSources: () => Promise<readonly ImportSourceSummary[]>;
  readonly onImportBrowserProfile: (sourceId: string, categories: readonly ImportCategory[]) => Promise<ImportResult>;
  readonly onImportBookmarksHtml: () => Promise<ImportResult | null>;
  readonly onClose: (completed: boolean) => void | Promise<void>;
}

export function readOnboardingState(storage: Pick<Storage, "getItem"> = localStorage): OnboardingState | null {
  const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OnboardingState>;
    if (!value || !["in-progress", "completed", "skipped"].includes(value.status ?? "") || !Number.isInteger(value.step) || value.step! < 0 || value.step! > LAST_STEP || !value.choices || typeof value.choices !== "object" || Array.isArray(value.choices)) return null;
    return { status: value.status!, step: value.step!, choices: value.choices };
  } catch { return null; }
}

export function shouldShowOnboarding(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  const state = readOnboardingState(storage);
  return !state || state.status === "in-progress";
}

export class OnboardingFlow {
  readonly element = element("div", "moon-onboarding-overlay");
  readonly #dialog = element("section", "moon-onboarding-dialog");
  readonly #body = element("div", "moon-onboarding-body");
  readonly #message = element("div", "moon-onboarding-message");
  readonly #storage: Storage;
  #state: OnboardingState;
  #sources: readonly ImportSourceSummary[] = [];
  #busy = false;

  constructor(readonly options: OnboardingFlowOptions) {
    this.#storage = options.storage ?? localStorage;
    const saved = readOnboardingState(this.#storage);
    this.#state = saved?.status === "in-progress" ? saved : { status: "in-progress", step: 0, choices: {} };
    this.options.store.beginPreview();
    this.#applySavedChoices();
    this.#persist();
    this.#build();
    this.#render();
  }

  #build(): void {
    this.element.dataset.testid = "moon-onboarding";
    this.#dialog.setAttribute("role", "dialog");
    this.#dialog.setAttribute("aria-modal", "true");
    this.#dialog.setAttribute("aria-labelledby", "moon-onboarding-title");
    this.element.append(this.#dialog);
    this.element.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const focusable = [...this.#dialog.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)')].filter(node => !node.hidden);
      if (!focusable.length) return;
      const first = focusable[0]!; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  #render(): void {
    this.#dialog.replaceChildren(); this.#message.textContent = ""; this.#message.classList.remove("is-error");
    const header = element("header", "moon-onboarding-header");
    const identity = element("div", "moon-onboarding-identity"); identity.append(icon("moon"), element("span", "", "MOON BROWSER"));
    const progress = element("ol", "moon-onboarding-progress");
    for (let index = 0; index <= LAST_STEP; index += 1) { const item = element("li"); item.dataset.active = String(index === this.#state.step); item.dataset.complete = String(index < this.#state.step); item.setAttribute("aria-label", `Etapa ${index + 1} de ${LAST_STEP + 1}`); progress.append(item); }
    header.append(identity, progress);
    this.#body.replaceChildren();
    [this.#appearance, this.#tabs, this.#import, this.#privacy, this.#intelligence, this.#finish][this.#state.step]!.call(this);
    const footer = element("footer", "moon-onboarding-footer");
    const skip = button("moon-text-button", "Pular configuração inicial"); skip.append(element("span", "", "Configurar depois")); skip.addEventListener("click", () => void this.#close(false));
    const actions = element("div", "moon-onboarding-actions");
    if (this.#state.step > 0) { const back = button("moon-secondary-button", "Voltar", "back"); back.append(element("span", "", "Voltar")); back.addEventListener("click", () => this.#move(-1)); actions.append(back); }
    const nextLabel = this.#state.step === LAST_STEP ? "Começar a navegar" : this.#state.step === 2 ? "Agora não / Continuar" : "Continuar";
    const next = button("moon-primary-button", nextLabel, this.#state.step === LAST_STEP ? "home" : "forward"); next.append(element("span", "", nextLabel)); next.addEventListener("click", () => this.#state.step === LAST_STEP ? void this.#close(true) : this.#move(1)); actions.append(next);
    footer.append(skip, actions); this.#dialog.append(header, this.#body, this.#message, footer);
    requestAnimationFrame(() => this.#dialog.querySelector<HTMLElement>("button, select, input")?.focus());
  }

  #intro(eyebrow: string, title: string, copy: string): void {
    const intro = element("header", "moon-onboarding-intro"); intro.append(element("span", "moon-onboarding-eyebrow", eyebrow), element("h1", "", title), element("p", "", copy)); intro.querySelector("h1")!.id = "moon-onboarding-title"; this.#body.append(intro);
  }

  #appearance(): void {
    this.#intro("ETAPA 1 · VISUAL", "Faça o Moon parecer seu", "Estas escolhas aparecem ao vivo e só são confirmadas quando você concluir.");
    this.#body.append(this.#choices("Tema", [["system", "Automático", "Segue o sistema"], ["dark", "Escuro", "Menos brilho"], ["light", "Claro", "Mais contraste"]], this.options.store.config.appearance.mode, value => this.#choose({ appearanceMode: value as OnboardingChoices["appearanceMode"] }, "appearance.mode", value)));
    this.#body.append(this.#choices("Densidade", [["compact", "Compacta", "Mais conteúdo"], ["comfortable", "Equilibrada", "Padrão Moon"], ["touch", "Toque", "Controles maiores"]], this.options.store.config.layout.density, value => this.#choose({ density: value as OnboardingChoices["density"] }, "layout.density", value)));
  }

  #tabs(): void {
    this.#intro("ETAPA 2 · ABAS", "Escolha onde suas abas vivem", "Você poderá mudar posição e largura a qualquer momento em Configurações → Layout.");
    this.#body.append(this.#choices("Posição", [["top", "Topo", "Clássico e compacto"], ["left", "Esquerda", "Vertical, títulos longos"], ["right", "Direita", "Vertical, área lateral"]], this.options.store.config.layout.tabs.position, value => this.#choose({ tabPosition: value as TabPosition }, "layout.tabs.position", value)));
  }

  #import(): void {
    this.#intro("ETAPA 3 · IMPORTAÇÃO OPCIONAL", "Traga só o que você escolher", "A leitura é local e somente favoritos e histórico entram no Moon. Senhas, cookies, sessões, extensões e carteiras nunca são importados.");
    const controls = element("div", "moon-onboarding-import-actions");
    const detect = button("moon-secondary-button", "Detectar navegadores instalados", "search"); detect.append(element("span", "", "Detectar navegadores")); detect.addEventListener("click", () => void this.#discover());
    const html = button("moon-secondary-button", "Importar favoritos de arquivo HTML", "download"); html.append(element("span", "", "Arquivo HTML")); html.addEventListener("click", () => void this.#importHtml()); controls.append(detect, html); this.#body.append(controls);
    if (this.#sources.length) { const list = element("div", "moon-onboarding-import-list"); this.#sources.forEach(source => list.append(this.#source(source))); this.#body.append(list); }
    else this.#body.append(element("p", "moon-onboarding-note", "Nada é lido até você clicar em detectar. A origem recebe um identificador opaco; caminhos locais não chegam à interface."));
  }

  #privacy(): void {
    this.#intro("ETAPA 4 · PESQUISA E PRIVACIDADE", "Defina sua busca padrão", "O bloqueio de anúncios fica ativo por padrão. Você controla permissões por site e pode revogá-las depois.");
    const field = element("label", "moon-onboarding-field"); field.append(element("span", "", "Buscador padrão")); const select = element("select", "moon-select");
    this.options.store.config.search.providers.forEach(provider => { const item = element("option", "", provider.name); item.value = provider.id; select.append(item); }); select.value = this.options.store.config.search.defaultEngine; select.addEventListener("change", () => this.#choose({ searchEngine: select.value }, "search.defaultEngine", select.value)); field.append(select); this.#body.append(field);
    const favicons = element("label", "moon-onboarding-toggle"); const input = element("input"); input.type = "checkbox"; input.checked = this.options.store.config.favicons.enabled; input.addEventListener("change", () => this.#choose({ favicons: input.checked }, "favicons.enabled", input.checked)); favicons.append(input, element("span", "", "Exibir ícones dos sites (cache local com validade)")); this.#body.append(favicons);
    const facts = element("ul", "moon-onboarding-facts"); ["AdBlock real ativado", "Permissões solicitadas por origem", "Janela anônima usa sessão efêmera e não é restaurada"].forEach(copy => facts.append(element("li", "", copy))); this.#body.append(facts);
  }

  #intelligence(): void {
    this.#intro("ETAPA 5 · MOON INTELLIGENCE", "IA continua desativada", "O Moon não vai fingir que uma caixa de texto é inteligência pronta. A ativação só será liberada com provider configurado, consentimento, budgets, memória controlável e segurança completos.");
    const card = element("article", "moon-onboarding-ai-card"); card.setAttribute("aria-disabled", "true"); card.append(icon("sparkles"), element("strong", "", "Moon Intelligence — indisponível neste build"), element("p", "", "Nenhum dado de navegação é enviado a um modelo. Quando a base segura estiver pronta, a configuração será explicitamente opt-in.")); this.#body.append(card);
  }

  #finish(): void {
    this.#intro("ETAPA 6 · PRONTO", "Seu Moon está pronto para navegar", "Comece pela omnibox. Nada exige conta e todas estas escolhas continuam editáveis.");
    const shortcuts = element("div", "moon-onboarding-shortcuts"); [["Ctrl + L", "Focar endereço e busca"], ["Ctrl + T", "Nova aba"], ["Ctrl + Shift + N", "Janela anônima"], ["Ctrl + ,", "Configurações"], ["Ctrl + Shift + W", "Workspaces"]].forEach(([keys, copy]) => { const row = element("div"); row.append(element("kbd", "", keys), element("span", "", copy)); shortcuts.append(row); }); this.#body.append(shortcuts);
  }

  #choices(label: string, values: readonly (readonly [string, string, string])[], active: string, change: (value: string) => void): HTMLElement {
    const group = element("fieldset", "moon-onboarding-choice-group"); group.append(element("legend", "", label)); const grid = element("div", "moon-onboarding-choices");
    values.forEach(([value, title, copy]) => { const choice = button(`moon-onboarding-choice${active === value ? " is-active" : ""}`, title); choice.dataset.value = value; choice.append(element("strong", "", title), element("small", "", copy)); choice.addEventListener("click", () => { change(value); this.#render(); }); grid.append(choice); }); group.append(grid); return group;
  }

  #source(source: ImportSourceSummary): HTMLElement {
    const row = element("article", "moon-onboarding-import-source"); const copy = element("div"); copy.append(element("strong", "", source.name), element("small", "", `Atualizado em ${new Intl.DateTimeFormat("pt-BR").format(source.modifiedAt)}`));
    const categories = element("div", "moon-import-categories"); const inputs = new Map<ImportCategory, HTMLInputElement>();
    (["bookmarks", "history"] as const).forEach(category => { const label = element("label", "moon-import-category"); const input = element("input"); input.type = "checkbox"; input.checked = source.categories[category] > 0; input.disabled = source.categories[category] === 0; inputs.set(category, input); label.append(input, element("span", "", `${category === "bookmarks" ? "Favoritos" : "Histórico"} (${source.categories[category]})`)); categories.append(label); });
    const run = button("moon-primary-button", `Importar seleção de ${source.name}`, "download"); run.append(element("span", "", "Importar seleção")); run.addEventListener("click", () => { const selected = [...inputs].filter(([, input]) => input.checked).map(([category]) => category); if (!selected.length) return this.#say("Selecione ao menos uma categoria.", true); void this.#runImport(source.id, selected); }); row.append(copy, categories, run); return row;
  }

  #choose(choice: Partial<OnboardingChoices>, path: string, value: unknown): void { if (!this.options.store.set(path, value)) return this.#say(this.options.store.lastError ?? "Não foi possível aplicar a escolha.", true); this.#state = { ...this.#state, choices: { ...this.#state.choices, ...choice } }; this.#persist(); }
  #move(delta: number): void { this.#state = { ...this.#state, step: Math.max(0, Math.min(LAST_STEP, this.#state.step + delta)) }; this.#persist(); this.#render(); }
  #persist(): void { this.#storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(this.#state)); }
  #applySavedChoices(): void { const choices = this.#state.choices; if (choices.appearanceMode) this.options.store.set("appearance.mode", choices.appearanceMode); if (choices.density) this.options.store.set("layout.density", choices.density); if (choices.tabPosition) this.options.store.set("layout.tabs.position", choices.tabPosition); if (choices.searchEngine) this.options.store.set("search.defaultEngine", choices.searchEngine); if (choices.favicons !== undefined) this.options.store.set("favicons.enabled", choices.favicons); }
  async #discover(): Promise<void> { if (this.#busy) return; this.#busy = true; this.#say("Procurando perfis locais…"); try { this.#sources = await this.options.onDiscoverImportSources(); this.#render(); if (!this.#sources.length) this.#say("Nenhum perfil compatível foi encontrado."); } catch (error) { this.#say(error, true); } finally { this.#busy = false; } }
  async #runImport(sourceId: string, categories: readonly ImportCategory[]): Promise<void> { if (this.#busy) return; this.#busy = true; this.#say("Importando em uma transação local…"); try { const result = await this.options.onImportBrowserProfile(sourceId, categories); this.#say(this.#resultMessage(result)); } catch (error) { this.#say(error, true); } finally { this.#busy = false; } }
  async #importHtml(): Promise<void> { if (this.#busy) return; this.#busy = true; try { const result = await this.options.onImportBookmarksHtml(); if (result) this.#say(this.#resultMessage(result)); } catch (error) { this.#say(error, true); } finally { this.#busy = false; } }
  #resultMessage(result: ImportResult): string { return `Importação concluída: ${result.imported.bookmarks} favoritos e ${result.imported.history} itens do histórico.`; }
  #say(value: unknown, error = false): void { this.#message.textContent = value instanceof Error ? value.message : String(value); this.#message.classList.toggle("is-error", error); }
  async #close(completed: boolean): Promise<void> { if (completed) { if (!await this.options.store.applyPreview()) return this.#say(this.options.store.lastError ?? "Não foi possível salvar as escolhas.", true); } else this.options.store.cancelPreview(); this.#state = { ...this.#state, status: completed ? "completed" : "skipped" }; this.#persist(); this.element.remove(); await this.options.onClose(completed); }
}
