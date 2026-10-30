import type { MoonBrowserBridge } from "../browser-shell/contracts.js";
import type { ProfileAccessStatus } from "../../apps/desktop/electron/services/profile-access.js";

export class ProfileSecurityPanel {
  readonly element = document.createElement("details");
  readonly #body = document.createElement("div");
  readonly #status = document.createElement("p");
  constructor(readonly bridge: MoonBrowserBridge) {
    this.element.className = "moon-profile-card";
    const summary = document.createElement("summary"); summary.textContent = "Segurança do perfil";
    this.#status.setAttribute("role", "status"); this.#status.setAttribute("aria-live", "polite");
    this.element.append(summary, this.#body, this.#status);
    void this.#reload();
  }
  async #reload(): Promise<void> {
    try { this.#render(await this.bridge.getProfileAccess()); }
    catch (error) { this.#status.textContent = error instanceof Error ? error.message : "Segurança indisponível."; }
  }
  #render(state: ProfileAccessStatus): void {
    this.#body.replaceChildren();
    const description = document.createElement("p");
    description.textContent = `${state.enabled ? "Proteção ativa." : "Proteção desativada."} A senha bloqueia acesso casual pelo Moon; não criptografa os arquivos. Não há recuperação de senha: guarde-a antes de ativar.`;
    const form = document.createElement("form"); form.className = "moon-profile-form";
    const field = (title: string, auto: "current-password" | "new-password") => {
      const label = document.createElement("label"); label.textContent = title;
      const input = document.createElement("input"); input.type = "password"; input.maxLength = 1024;
      input.className = "moon-settings-input"; input.autocomplete = auto;
      input.setAttribute("aria-label", title); label.append(input); form.append(label); return input;
    };
    const current = state.enabled ? field("Senha atual", "current-password") : undefined;
    const next = field(state.enabled ? "Nova senha (somente para alterar)" : "Nova senha", "new-password");
    const repeated = field("Confirmar nova senha", "new-password");
    const idleLabel = document.createElement("label"); idleLabel.textContent = "Bloquear por inatividade do computador";
    const idle = document.createElement("select"); idle.className = "moon-select"; idle.setAttribute("aria-label", "Bloqueio por inatividade");
    for (const minutes of [0, 1, 5, 15, 30, 60, 120, 240]) {
      const option = document.createElement("option"); option.value = String(minutes); option.textContent = minutes ? `${minutes} minuto(s)` : "Desativado"; option.selected = state.idleMinutes === minutes; idle.append(option);
    }
    idle.disabled = !state.enabled; idleLabel.append(idle);
    const screenLabel = document.createElement("label");
    const screen = document.createElement("input"); screen.type = "checkbox"; screen.checked = state.lockOnSystem;
    screen.disabled = !state.enabled || !state.supportsSystemLock;
    screenLabel.append(screen, document.createTextNode(state.supportsSystemLock ? " Bloquear quando o sistema bloquear a tela" : " Bloqueio pela tela do sistema indisponível aqui; use a inatividade"));
    const controls: HTMLButtonElement[] = [];
    const button = (title: string, action: () => Promise<unknown>) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "moon-secondary-button"; button.textContent = title;
      controls.push(button); button.addEventListener("click", () => { void perform(action); }); form.append(button); return button;
    };
    const perform = async (action: () => Promise<unknown>) => {
      controls.forEach(button => { button.disabled = true; });
      try { const result = await action(); this.#status.textContent = result === false ? "Operação cancelada." : "Configuração atualizada."; await this.#reload(); }
      catch (error) { this.#status.textContent = error instanceof Error ? error.message : "Não foi possível atualizar."; }
      finally { if (current) current.value = ""; next.value = ""; repeated.value = ""; controls.forEach(button => { button.disabled = false; }); }
    };
    const savePassword = async () => {
      if (next.value !== repeated.value) throw new Error("As senhas não coincidem.");
      if (state.enabled) return this.bridge.changeProfilePassword(current!.value, next.value);
      return this.bridge.enableProfileAccess(next.value);
    };
    form.addEventListener("submit", event => { event.preventDefault(); void perform(savePassword); });
    button(state.enabled ? "Alterar senha" : "Ativar proteção", savePassword);
    if (state.enabled) {
      button("Desativar proteção", () => this.bridge.disableProfileAccess(current!.value));
      form.append(idleLabel, screenLabel);
      button("Salvar bloqueio automático", () => this.bridge.configureProfileAccess(current!.value, Number(idle.value), screen.checked));
      button("Bloquear agora", () => this.bridge.lockProfile());
    }
    this.#body.append(description, form);
  }
}
