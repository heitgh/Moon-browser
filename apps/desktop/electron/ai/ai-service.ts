import { dialog } from "electron";
import { freemem } from "node:os";
import type { AiChunk, AiRequest, AiResult, AiState } from "../../../../packages/ipc/ai-contract.js";
import { localResearch, type ResearchMode } from "../../../../packages/research/research.js";
import type { WindowManager } from "../main/window-manager.js";
import { consentText, type NativeConsent } from "../security/native-consent.js";
import type { LocalProfileManager } from "../services/local-profile-manager.js";
import { AiContextService, redactCredentials } from "./ai-context-service.js";
import { inspectAiModel } from "./ai-model-file.js";
import type { AiProvider } from "./ai-provider.js";

interface Task {
  readonly abort: AbortController;
  pid: number | null;
}
export class AiService {
  readonly #tasks = new Map<string, Task>();
  readonly #watched = new Set<string>();
  #modelBusy = false;
  #stopped = false;

  constructor(readonly windows: WindowManager, readonly profiles: LocalProfileManager, readonly context: AiContextService,
    readonly consent: NativeConsent, readonly provider: AiProvider) {}

  activePids(): ReadonlySet<number> {
    return new Set([...this.#tasks.values()].flatMap(task => task.pid === null ? [] : [task.pid]));
  }

  #normal(windowId: string): string {
    if (this.#stopped || !this.windows.get(windowId)) throw new Error("A janela está encerrando.");
    if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) throw new Error("Moon AI está disponível em janelas normais.");
    return this.windows.profileId(windowId);
  }

  async state(windowId: string): Promise<AiState> {
    if (this.windows.isPrivate(windowId) || this.windows.isGuest(windowId)) return {available: false, model: null, selection: null};
    const profileId = this.#normal(windowId);
    const model = await this.profiles.openedStorage(profileId).loadAiModel();
    return {available: true, model: model ? {name: model.name, bytes: model.bytes} : null, selection: this.context.describeSelection(windowId)};
  }

  async chooseModel(windowId: string, guard: () => void): Promise<AiState> {
    const profileId = this.#normal(windowId);
    const host = this.windows.require(windowId);
    const result = await dialog.showOpenDialog(host, {
      title: "Selecionar modelo local GGUF",
      properties: ["openFile"],
      filters: [{name: "Modelo GGUF", extensions: ["gguf"]}]
    });
    guard();
    if (result.canceled || result.filePaths.length !== 1) return this.state(windowId);
    const model = await inspectAiModel(result.filePaths[0]!);
    const required = Math.ceil((model.bytes * 2.5 + 512 * 1024 ** 2) / 1024 ** 2);
    const accepted = await this.consent.confirm(host, profileId, {
      title: "Ativar modelo local",
      message: `Usar ${consentText(model.name, 160)} neste perfil?`,
      detail: `Tamanho: ${Math.round(model.bytes / 1024 ** 2)} MiB. Estimativa conservadora: ${required} MiB livres. Usa CPU e funciona sem nuvem. Selecione apenas modelos de uma fonte em que confia.`,
      accept: "Usar modelo local"
    }, guard);
    if (!accepted) return this.state(windowId);
    const current = await inspectAiModel(model.path);
    guard();
    if (current.identity !== model.identity) throw new Error("O arquivo do modelo mudou. Selecione novamente.");
    await this.profiles.openedStorage(profileId).saveAiModel(model);
    return this.state(windowId);
  }

  async disableModel(windowId: string, guard: () => void): Promise<AiState> {
    const profileId = this.#normal(windowId);
    this.cancelProfile(profileId);
    guard();
    await this.profiles.openedStorage(profileId).saveAiModel(null);
    return this.state(windowId);
  }

  async run(windowId: string, request: AiRequest, guard: () => void, emit: (chunk: AiChunk) => void): Promise<AiResult> {
    const profileId = this.#normal(windowId);
    if (this.#tasks.has(windowId)) throw new Error("Interrompa a tarefa em andamento antes de iniciar outra.");
    if (request.mode === "model" && this.#modelBusy) throw new Error("Outro modelo local já está executando.");
    const task: Task = {abort: new AbortController(), pid: null};
    const assertActive = () => {
      if (task.abort.signal.aborted) throw new Error("Tarefa interrompida.");
      guard();
      this.#normal(windowId);
    };
    this.#tasks.set(windowId, task);
    if (request.mode === "model") this.#modelBusy = true;
    this.watchWindow(windowId);
    try {
      let modelPath: string | undefined;
      if (request.mode === "model") {
        const saved = await this.profiles.openedStorage(profileId).loadAiModel();
        if (!saved) throw new Error("Selecione um modelo GGUF para usar a geração local.");
        const model = await inspectAiModel(saved.path);
        if (model.identity !== saved.identity) throw new Error("O modelo mudou. Selecione o arquivo novamente.");
        if (freemem() < model.bytes * 2.5 + 512 * 1024 ** 2) throw new Error("Memória livre insuficiente para este modelo.");
        modelPath = model.path;
      }
      const captured = await this.context.read(windowId, request, assertActive);
      captured.assertCurrent();
      const question = redactCredentials(request.question);
      const refs = captured.sources.map(source => ({title: source.title, url: source.url}));
      if (modelPath) {
        const text = await this.provider.generate({
          modelPath, operation: request.operation, question,
          sources: captured.sources.map(({title, text}) => ({title: redactCredentials(title), text}))
        }, {
          signal: task.abort.signal,
          onPid: pid => { task.pid = pid; },
          onChunk: text => {
            captured.assertCurrent();
            emit({id: request.id, text});
          }
        });
        captured.assertCurrent();
        return {text, sources: refs};
      }
      const mode: Record<AiRequest["operation"], ResearchMode> = {
        summary: "short", compare: "compare", tasks: "checklist", question: "question"
      };
      const result = localResearch(captured.sources, mode[request.operation], question);
      return {text: result.markdown, sources: refs};
    } finally {
      this.#tasks.delete(windowId);
      if (request.mode === "model") this.#modelBusy = false;
    }
  }

  watchWindow(windowId: string): void {
    if (this.#watched.has(windowId)) return;
    this.#watched.add(windowId);
    this.windows.require(windowId).once("closed", () => {
      this.cancel(windowId);
      this.#watched.delete(windowId);
    });
  }

  cancel(windowId: string): void {
    this.#tasks.get(windowId)?.abort.abort();
    this.context.clear(windowId);
  }

  cancelProfile(profileId: string): void {
    for (const windowId of this.#watched) {
      if (this.windows.get(windowId) && this.windows.profileId(windowId) === profileId) this.cancel(windowId);
    }
  }

  stop(): void {
    this.#stopped = true;
    for (const task of this.#tasks.values()) task.abort.abort();
    this.context.clearAll();
  }
}
