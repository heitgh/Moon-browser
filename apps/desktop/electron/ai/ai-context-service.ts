import type { AiRequest } from "../../../../packages/ipc/ai-contract.js";
import type { ResearchSource } from "../../../../packages/research/research.js";
import type { ElectronBrowserManager } from "../browser/browser-manager.js";
import type { WindowManager } from "../main/window-manager.js";
import { consentText, type NativeConsent } from "../security/native-consent.js";

type DocumentRef = ReturnType<ElectronBrowserManager["researchDocument"]>;
interface Selection {
  readonly tabId: string;
  readonly document: DocumentRef;
  readonly text: string;
  readonly expiresAt: number;
}

// Filter common credentials as a defense in depth. Source selection still requires review.
export function redactCredentials(text: string): string {
  return text
    .replace(/\b(?:ghp_|github_pat_|sk-[A-Za-z0-9_-]*|AKIA)[A-Za-z0-9_-]{12,}\b/g, "[credencial omitida]")
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9_./+=-]{12,}/gi, "[credencial omitida]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[token omitido]");
}

function publicUrl(input: string): string {
  const url = new URL(input);
  url.search = "";
  url.hash = "";
  return url.href;
}

export interface CapturedAiContext {
  readonly sources: readonly ResearchSource[];
  readonly assertCurrent: () => void;
}

export class AiContextService {
  readonly #selections = new Map<string, Selection>();

  constructor(readonly browser: ElectronBrowserManager, readonly windows: WindowManager, readonly consent: NativeConsent) {}

  offerSelection(windowId: string, tabId: string, text: string): boolean {
    if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) return false;
    const selected = redactCredentials(text.trim().slice(0, 2500));
    if (!selected) return false;
    const document = this.browser.researchDocument(tabId, windowId);
    this.#selections.set(windowId, {tabId, document, text: selected, expiresAt: Date.now() + 120_000});
    return true;
  }

  describeSelection(windowId: string): { title: string; length: number } | null {
    const selection = this.#selection(windowId);
    return selection ? {title: consentText(selection.document.title, 160), length: selection.text.length} : null;
  }

  clear(windowId: string): void { this.#selections.delete(windowId); }
  clearAll(): void { this.#selections.clear(); }

  async read(windowId: string, request: AiRequest, guard: () => void): Promise<CapturedAiContext> {
    guard();
    if (request.context === "none") return {sources: [], assertCurrent: guard};
    const selection = request.context === "selection" ? this.#selection(windowId) : undefined;
    if (request.context === "selection" && !selection) throw new Error("Selecione o texto novamente no menu da página.");
    const docs = selection
      ? [{tabId: selection.tabId, document: selection.document}]
      : request.tabIds.map(tabId => ({tabId, document: this.browser.researchDocument(tabId, windowId)}));
    const workspace = docs[0]?.document.workspaceId;
    if (!workspace || docs.some(item => item.document.workspaceId !== workspace)) {
      throw new Error("Escolha fontes de uma única área desta janela.");
    }
    const assertCurrent = () => {
      guard();
      for (const item of docs) {
        if (!this.#matches(windowId, item.tabId, item.document)) throw new Error("Uma fonte mudou. Revise o contexto novamente.");
      }
    };
    const check = () => {
      assertCurrent();
      if (selection && this.#selection(windowId) !== selection) throw new Error("A seleção mudou ou expirou.");
    };
    const approved = await this.consent.confirm(this.windows.require(windowId), this.windows.profileId(windowId), {
      title: "Autorizar contexto para Moon AI",
      message: selection ? "Permitir a leitura do texto selecionado?" : "Permitir a leitura do texto visível destas páginas?",
      detail: `O conteúdo será processado neste dispositivo. Revise as fontes e evite dados sensíveis.\n\n` +
        docs.map(({document}) => `${consentText(document.title, 100)} — ${new URL(document.url).origin}`).join("\n"),
      accept: "Autorizar uma vez"
    }, check);
    if (!approved) throw new Error("Leitura cancelada.");
    check();
    if (selection) {
      this.clear(windowId);
      return {assertCurrent, sources: [{tabId: selection.tabId, title: selection.document.title.slice(0, 160),
        url: publicUrl(selection.document.url), text: selection.text, truncated: false}]};
    }
    const sources: ResearchSource[] = [];
    for (const item of docs) {
      check();
      const source = await this.browser.readResearchSource(item.tabId, windowId);
      check();
      sources.push({...source, url: publicUrl(source.url), text: redactCredentials(source.text).slice(0, 3500)});
    }
    return {sources, assertCurrent};
  }

  #matches(windowId: string, tabId: string, reviewed: DocumentRef): boolean {
    try {
      const current = this.browser.researchDocument(tabId, windowId);
      return current.contentsId === reviewed.contentsId && current.version === reviewed.version &&
        current.url === reviewed.url && current.workspaceId === reviewed.workspaceId;
    } catch {
      return false;
    }
  }

  #selection(windowId: string): Selection | undefined {
    const item = this.#selections.get(windowId);
    if (!item) return;
    if (item.expiresAt < Date.now() || !this.#matches(windowId, item.tabId, item.document)) {
      this.clear(windowId);
      return;
    }
    return item;
  }
}
