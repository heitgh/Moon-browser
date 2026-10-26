// Nexus Inc. — visible beneath web content; a ResizeObserver resizes the native view.
import type { ManagedDownload } from "../browser-shell/contracts.js";
import type { NativeUpdateState } from "../../packages/ipc/native-update-contract.js";
import { element, button } from "../browser-shell/dom.js";

export class DownloadShelf {
  readonly element = element("section", "moon-download-shelf");
  readonly #dismissed = new Set<string>();
  constructor(readonly actions: { open(): void; pause(id: string): void; resume(id: string): void; cancel(id: string): void }) {
    this.element.setAttribute("aria-label", "Acompanhamento de downloads"); this.element.hidden = true;
  }
  render(downloads: readonly ManagedDownload[], update?: NativeUpdateState): void {
    const visible = downloads.filter(item => !this.#dismissed.has(item.id));
    const active = visible.filter(item => ["in-progress", "paused"].includes(item.state));
    const items = [...active, ...visible.filter(item => !active.includes(item))].slice(0, 3);
    const updating = update && ["checking", "downloading", "downloaded", "installing", "error"].includes(update.phase);
    this.element.hidden = !items.length && !updating; this.element.replaceChildren();
    if (this.element.hidden) return;
    if (updating) this.#row("Moon + Chromium", update.percent, update.message ?? "Atualizando…");
    for (const item of items) {
      const received = bytes(item.receivedBytes); const total = item.totalBytes > 0 ? bytes(item.totalBytes) : "tamanho desconhecido";
      const label = item.state === "completed" ? "Concluído" : item.state === "paused" ? "Pausado" : item.state === "failed" ? "Falhou" : item.state === "cancelled" ? "Cancelado" : `${item.percentage === null ? "" : `${Math.floor(item.percentage)}% · `}${received} / ${total} · ${bytes(item.speedBytesPerSecond)}/s`;
      const row = this.#row(item.filename, item.percentage ?? undefined, label);
      const action = (text: string, run: () => void): void => { const control = button("moon-text-button", `${text}: ${item.filename}`); control.textContent = text; control.addEventListener("click", run); row.append(control); };
      if (item.state === "in-progress") action("Pausar", () => this.actions.pause(item.id));
      if (item.state === "paused") action("Continuar", () => this.actions.resume(item.id));
      if (["in-progress", "paused"].includes(item.state)) action("Cancelar", () => this.actions.cancel(item.id));
      else action("Dispensar", () => { this.#dismissed.add(item.id); this.render(downloads, update); });
    }
    const open = button("moon-secondary-button", "Abrir painel de downloads"); open.textContent = `Downloads (${downloads.length})`; open.addEventListener("click", () => this.actions.open()); this.element.append(open);
  }
  #row(title: string, value: number | undefined, detail: string): HTMLElement {
    const row = element("article", "moon-download-shelf-item");
    const copy = element("div", "moon-download-shelf-copy"); copy.append(element("strong", "", title), element("small", "", detail));
    const progress = element("progress"); progress.max = 100; progress.setAttribute("aria-label", `Progresso: ${title}`);
    if (value !== undefined) progress.value = Math.max(0, Math.min(100, value));
    copy.append(progress); row.append(copy); this.element.append(row); return row;
  }
}
function bytes(value: number): string { const amount = Math.max(0, value); return amount < 1024 ? `${Math.round(amount)} B` : amount < 1024 * 1024 ? `${(amount / 1024).toFixed(1)} KB` : `${(amount / 1024 / 1024).toFixed(1)} MB`; }
