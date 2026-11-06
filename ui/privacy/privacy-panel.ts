import type { PrivacySettings, PrivacyState } from "../../packages/ipc/privacy-contract.js";
import type { SitePermissionRecord } from "../../packages/ipc/site-permission-contract.js";
import { button, element } from "../browser-shell/dom.js";

interface PrivacyClient {
  load(): Promise<PrivacyState>;
  save(settings: PrivacySettings): Promise<PrivacyState>;
  clearSite(origin: string): Promise<boolean>;
  forgetPermission(record: SitePermissionRecord): Promise<void>;
}

export class PrivacyPanel {
  readonly element = element("section", "moon-privacy-panel");
  readonly #status = element("p", "moon-drawer-description");
  readonly #controls = element("fieldset", "moon-privacy-fields");
  readonly #permissions = element("div", "moon-panel-list");
  readonly #tracker = element("input");
  readonly #cookies = element("select", "moon-settings-input");
  readonly #trackerExceptions = element("textarea", "moon-settings-input");
  readonly #cookieExceptions = element("textarea", "moon-settings-input");
  readonly #site = element("input", "moon-settings-input");
  readonly #filterStatus = element("p", "moon-drawer-description");
  #editable = false;
  #busy = false;

  constructor(readonly client: PrivacyClient) {
    this.#status.setAttribute("role", "status");
    this.#status.textContent = "Carregando as opções do perfil…";
    this.#tracker.type = "checkbox";
    this.#trackerExceptions.rows = 3;
    this.#cookieExceptions.rows = 3;
    this.#site.placeholder = "https://example.com";
    this.#site.maxLength = 2048;
    this.#cookies.append(
      this.#option("standard", "Padrão do Chromium"),
      this.#option("block-third-party", "Bloquear cookies HTTP de terceiros"),
      this.#option("block-all", "Bloquear todos os cookies HTTP")
    );
    const save = this.#button("Salvar privacidade", () => this.#run(async () => {
      const result = await client.save({
        version: 1,
        trackerProtection: this.#tracker.checked,
        networkCookies: this.#cookies.value as PrivacySettings["networkCookies"],
        trackerExceptions: this.#origins(this.#trackerExceptions.value),
        cookieExceptions: this.#origins(this.#cookieExceptions.value)
      });
      this.#apply(result);
      this.#status.textContent = result.saved ? "Opções aplicadas às próximas requisições." : "Alteração cancelada.";
    }));
    const clear = this.#button("Excluir dados do site", () => this.#run(async () => {
      const deleted = await client.clearSite(this.#site.value.trim());
      this.#status.textContent = deleted ? "Dados do site removidos nas sessões conhecidas." : "Exclusão cancelada.";
    }));
    this.#controls.append(
      element("legend", "", "Controles deste perfil"),
      this.#label("Proteger contra anúncios e rastreadores", this.#tracker),
      this.#filterStatus,
      this.#label("Cookies HTTP", this.#cookies),
      element("p", "", "O filtro altera os cabeçalhos Cookie e Set-Cookie na rede. Scripts, outros armazenamentos e técnicas de identificação têm controles separados. A opção de terceiros usa o site principal, o domínio registrável e o esquema."),
      this.#label("Exceções de rastreadores (uma origem por linha)", this.#trackerExceptions),
      this.#label("Exceções de cookies (uma origem por linha)", this.#cookieExceptions),
      element("p", "", "Uma exceção vale para a página principal daquela origem. Alguns logins e integrações podem exigir uma exceção. Use https://example.com, sem caminho."),
      save,
      element("h4", "", "Excluir dados do site"),
      this.#label("Origem do site para excluir dados", this.#site),
      element("p", "", "Remove dados na sessão padrão e nas áreas conhecidas deste perfil. Pode encerrar logins. A confirmação nativa apresenta o destino."),
      clear
    );
    this.#controls.disabled = true;
    this.element.append(element("h3", "", "Privacidade"), this.#controls,
      element("h4", "", "Permissões por site"), this.#permissions,
      element("p", "", "O Moon guarda os diagnósticos opt-in no dispositivo. O aplicativo consulta o GitHub para atualizações e o fornecedor das listas para o bloqueio. A navegação envia solicitações aos sites que você abre."),
      this.#status);
    void client.load().then(state => {
      this.#apply(state);
      this.#status.textContent = state.warning ?? (state.editable ? "" : "Em janelas privadas e temporárias, as opções do perfil são somente leitura.");
    }, error => this.#status.textContent = error instanceof Error ? error.message : "Privacidade indisponível.");
  }

  #origins(value: string): string[] {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  #option(value: string, label: string): HTMLOptionElement {
    const option = element("option", "", label);
    option.value = value;
    return option;
  }

  #label(text: string, input: HTMLElement): HTMLLabelElement {
    const label = element("label", "moon-privacy-label");
    label.append(element("span", "", text), input);
    return label;
  }

  #button(title: string, action: () => void): HTMLButtonElement {
    const control = button("moon-secondary-button", title);
    control.textContent = title;
    control.type = "button";
    control.addEventListener("click", action);
    return control;
  }

  #apply(state: PrivacyState): void {
    this.#editable = state.editable;
    this.#controls.disabled = !this.#editable || this.#busy;
    this.#tracker.checked = state.settings.trackerProtection;
    this.#cookies.value = state.settings.networkCookies;
    this.#trackerExceptions.value = state.settings.trackerExceptions.join("\n");
    this.#cookieExceptions.value = state.settings.cookieExceptions.join("\n");
    this.#filterStatus.textContent = {
      active: "Listas de bloqueio ativas.",
      disabled: "Proteção desativada neste perfil.",
      loading: "Listas ainda indisponíveis. Aguarde a inicialização.",
      failed: "O carregamento das listas falhou."
    }[state.protection.phase];
    this.#renderPermissions(state.permissions);
  }

  #renderPermissions(records: readonly SitePermissionRecord[]): void {
    this.#permissions.replaceChildren();
    if (!records.length) this.#permissions.append(element("p", "", "Nenhuma decisão persistente disponível nesta janela."));
    for (const record of records) {
      const row = element("article", "moon-list-card");
      row.append(element("p", "", `${record.origin} · ${record.permission} · ${record.decision === "allow" ? "Permitido" : "Negado"}`));
      const forget = this.#button(`Esquecer ${record.permission} de ${record.origin}`, () => this.#run(async () => {
        await this.client.forgetPermission(record);
        this.#renderPermissions((await this.client.load()).permissions);
        this.#status.textContent = "Permissão esquecida. O site pode solicitar novamente.";
        this.#permissions.querySelector("button")?.focus();
      }));
      row.append(forget);
      this.#permissions.append(row);
    }
  }

  #run(action: () => Promise<void>): void {
    if (!this.#editable || this.#busy) return;
    this.#busy = true;
    this.#controls.disabled = true;
    void action().catch(error => {
      this.#status.textContent = error instanceof Error ? error.message : "Não foi possível aplicar a alteração.";
    }).finally(() => {
      this.#busy = false;
      this.#controls.disabled = !this.#editable;
    });
  }
}
