import type { Workspace } from "../browser-shell/contracts.js";
import { button, element, icon } from "../browser-shell/dom.js";
import { FocusSessionController, type FocusMode, type FocusPreset } from "./focus-session-controller.js";

export interface FocusPanelOptions {
  readonly controller: () => FocusSessionController | undefined;
  readonly workspaces: () => readonly Workspace[];
  readonly privateWindow: () => boolean;
  readonly pendingNavigation: () => string | undefined;
  readonly onProceedNavigation: (url: string) => void;
  readonly onDismissNavigation: () => void;
  readonly onEnd: () => void;
}

export class FocusPanel {
  #target: HTMLElement | undefined;

  constructor(readonly options: FocusPanelOptions) {}

  render(target: HTMLElement): void {
    this.#target = target; target.replaceChildren(); const controller = this.options.controller();
    if (!controller) return target.append(this.#empty());
    const state = controller.state;
    if (!state) return this.#configuration(target, controller);
    const hero = element("div", "moon-focus-hero"); hero.append(icon("moon"), element("span", "moon-focus-phase", phaseLabel(state.status, state.phase)), element("strong", "moon-focus-countdown", formatRemaining(controller.remainingMs())));
    const detail = element("p", "moon-drawer-description", `${presetLabel(state.preset)} · ${state.mode === "continuous" ? "contínuo" : state.mode === "pomodoro" ? `ciclo ${state.completedCycles + 1}/${state.cycles}` : state.mode === "until" ? "até o horário escolhido" : `${state.durationMinutes} minutos`}. O layout anterior volta exatamente ao encerrar.`);
    const actions = element("div", "moon-focus-actions");
    const pause = button("moon-secondary-button", state.status === "paused" ? "Retomar sessão" : "Pausar sessão", state.status === "paused" ? "play" : "pause"); pause.append(element("span", "", state.status === "paused" ? "Retomar" : "Pausar")); pause.addEventListener("click", () => { state.status === "paused" ? controller.resume() : controller.pause(); this.render(target); });
    const extend = button("moon-secondary-button", "Estender sessão em 5 minutos", "plus"); extend.append(element("span", "", "+5 min")); extend.disabled = state.mode === "continuous"; extend.addEventListener("click", () => { controller.extend(5); this.render(target); });
    const end = button("moon-danger-button", "Encerrar sessão de foco", "stop"); end.append(element("span", "", "Encerrar")); end.addEventListener("click", () => { controller.end(); this.options.onEnd(); }); actions.append(pause, extend, end); target.append(hero, detail, actions);
    const pending = this.options.pendingNavigation(); if (pending) target.append(this.#warning(pending));
  }

  updateLive(): void {
    const state = this.options.controller()?.state; const countdown = this.#target?.querySelector(".moon-focus-countdown"); if (countdown) countdown.textContent = formatRemaining(this.options.controller()?.remainingMs()); const phase = this.#target?.querySelector(".moon-focus-phase"); if (phase && state) phase.textContent = phaseLabel(state.status, state.phase);
  }

  indicatorText(): string {
    const controller = this.options.controller(); const state = controller?.state; return state ? `${phaseLabel(state.status, state.phase, false)} · ${formatRemaining(controller?.remainingMs())} · Sair` : "Sair do Foco";
  }

  #configuration(target: HTMLElement, controller: FocusSessionController): void {
    const intro = element("p", "moon-drawer-description", `Baixa distração sem aprisionar. ${this.options.privateWindow() ? "Nesta janela anônima, a sessão existe só em memória." : "Uma sessão interrompida pode ser retomada após reiniciar."}`);
    const form = element("form", "moon-focus-form");
    const preset = select("Preset de foco", [["study", "Estudo"], ["reading", "Leitura"], ["writing", "Escrita"], ["research", "Pesquisa"], ["programming", "Programação"], ["custom", "Personalizado"]]);
    const mode = select("Modo da sessão", [["timed", "Sessão temporizada"], ["pomodoro", "Pomodoro"], ["continuous", "Foco contínuo"], ["until", "Foco até um horário"]]);
    const duration = numberField("Duração (min)", 25, 1, 240); const pause = numberField("Pausa (min)", 5, 1, 60); const cycles = numberField("Ciclos", 4, 1, 12);
    const untilField = element("label", "moon-field"); untilField.append(element("span", "", "Até")); const until = element("input", "moon-settings-input"); until.type = "time"; until.value = new Date(Date.now() + 60 * 60_000).toTimeString().slice(0, 5); untilField.append(until);
    const hosts = element("label", "moon-field"); hosts.append(element("span", "", "Sites permitidos (opcional, separados por vírgula)")); const hostInput = element("input", "moon-settings-input"); hostInput.placeholder = "docs.example.com, github.com"; hosts.append(hostInput);
    const workspaceGroup = element("fieldset", "moon-focus-workspaces"); workspaceGroup.append(element("legend", "", "Limitar a workspaces (opcional)")); const workspaceInputs = new Map<string, HTMLInputElement>(); this.options.workspaces().forEach(workspace => { const label = element("label"); const input = element("input"); input.type = "checkbox"; workspaceInputs.set(workspace.id, input); label.append(input, element("span", "", workspace.name)); workspaceGroup.append(label); });
    const alert = element("label", "moon-toggle-row"); const alertInput = element("input"); alertInput.type = "checkbox"; alertInput.checked = true; alert.append(element("span", "", "Alertar nas transições"), alertInput, element("span", "moon-toggle-control"));
    const applyPreset = (): void => { const values: Readonly<Record<string, readonly [FocusMode, number, number, number]>> = { study: ["pomodoro", 25, 5, 4], reading: ["timed", 45, 5, 1], writing: ["continuous", 50, 10, 1], research: ["timed", 50, 10, 1], programming: ["pomodoro", 50, 10, 3], custom: [mode.value as FocusMode, Number(duration.input.value), Number(pause.input.value), Number(cycles.input.value)] }; const selected = values[preset.value]!; mode.value = selected[0]; duration.input.value = String(selected[1]); pause.input.value = String(selected[2]); cycles.input.value = String(selected[3]); }; preset.addEventListener("change", applyPreset);
    const start = button("moon-primary-button", "Iniciar sessão de foco", "play"); start.type = "submit"; start.append(element("span", "", "Iniciar Foco"));
    form.append(preset, mode, duration.field, pause.field, cycles.field, untilField, hosts, workspaceGroup, alert, start); form.addEventListener("submit", event => { event.preventDefault(); const [hours, minutes] = until.value.split(":").map(Number); const untilDate = new Date(); untilDate.setHours(hours ?? 0, minutes ?? 0, 0, 0); if (untilDate.getTime() <= Date.now()) untilDate.setDate(untilDate.getDate() + 1); controller.start({ mode: mode.value as FocusMode, preset: preset.value as FocusPreset, durationMinutes: Number(duration.input.value), breakMinutes: Number(pause.input.value), cycles: Number(cycles.input.value), ...(mode.value === "until" ? { until: untilDate.getTime() } : {}), alert: alertInput.checked, allowedHosts: hostInput.value.split(","), workspaceIds: [...workspaceInputs].filter(([, input]) => input.checked).map(([id]) => id) }); this.render(target); }); applyPreset(); target.append(intro, form);
  }

  #warning(url: string): HTMLElement { const warning = element("div", "moon-focus-warning"); warning.append(element("strong", "", "Fora da sua lista de foco"), element("p", "", hostname(url))); const proceed = button("moon-secondary-button", "Navegar mesmo assim", "forward"); proceed.append(element("span", "", "Continuar uma vez")); proceed.addEventListener("click", () => this.options.onProceedNavigation(url)); const stay = button("moon-primary-button", "Continuar no foco", "moon"); stay.append(element("span", "", "Ficar no foco")); stay.addEventListener("click", () => { this.options.onDismissNavigation(); warning.remove(); }); warning.append(proceed, stay); return warning; }
  #empty(): HTMLElement { const empty = element("div", "moon-empty"); empty.append(icon("play"), element("strong", "", "Foco indisponível"), element("p", "", "O controlador ainda está iniciando.")); return empty; }
}

function select(label: string, entries: readonly (readonly [string, string])[]): HTMLSelectElement { const node = element("select", "moon-select"); node.setAttribute("aria-label", label); entries.forEach(([value, text]) => { const option = element("option", "", text); option.value = value; node.append(option); }); return node; }
function numberField(label: string, value: number, min: number, max: number): { readonly field: HTMLElement; readonly input: HTMLInputElement } { const field = element("label", "moon-field"); field.append(element("span", "", label)); const input = element("input", "moon-settings-input"); input.type = "number"; input.min = String(min); input.max = String(max); input.value = String(value); field.append(input); return { field, input }; }
function formatRemaining(remaining: number | null | undefined): string { if (remaining === null || remaining === undefined) return "CONTÍNUO"; const seconds = Math.max(0, Math.ceil(remaining / 1_000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function phaseLabel(status: string, phase: string, uppercase = true): string { const label = status === "paused" ? "Pausado" : phase === "break" ? "Pausa" : "Foco"; return uppercase ? label.toLocaleUpperCase("pt-BR") : label; }
function presetLabel(preset: FocusPreset): string { return ({ study: "Estudo", reading: "Leitura", writing: "Escrita", research: "Pesquisa", programming: "Programação", custom: "Personalizado" })[preset]; }
function hostname(url: string): string { try { return new URL(url).hostname; } catch { return url; } }
