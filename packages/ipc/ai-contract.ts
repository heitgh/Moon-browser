export type AiMode = "research" | "model";
export type AiOperation = "summary" | "compare" | "tasks" | "question";
export type AiContext = "none" | "selection" | "tabs";
export interface AiRequest {
  readonly id: string;
  readonly mode: AiMode;
  readonly operation: AiOperation;
  readonly context: AiContext;
  readonly question: string;
  readonly tabIds: readonly string[];
}
export interface AiSource {
  readonly title: string;
  readonly url: string;
}
export interface AiResult {
  readonly text: string;
  readonly sources: readonly AiSource[];
}
export interface AiChunk {
  readonly id: string;
  readonly text: string;
}
export interface AiState {
  readonly available: boolean;
  readonly model: { readonly name: string; readonly bytes: number } | null;
  readonly selection: { readonly title: string; readonly length: number } | null;
}

export function parseAiRequest(value: unknown): AiRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Pedido de IA inválido.");
  const request = value as Record<string, unknown>;
  if (typeof request.id !== "string" || !/^[a-f0-9-]{36}$/i.test(request.id) ||
      (request.mode !== "research" && request.mode !== "model") ||
      typeof request.operation !== "string" || !["summary", "compare", "tasks", "question"].includes(request.operation) ||
      typeof request.context !== "string" || !["none", "selection", "tabs"].includes(request.context) ||
      typeof request.question !== "string" || request.question.length > 1500 ||
      !Array.isArray(request.tabIds) || request.tabIds.length > 4 ||
      !request.tabIds.every(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id))) {
    throw new Error("Pedido de IA inválido.");
  }
  const context = request.context as AiContext;
  const tabIds = [...new Set(request.tabIds as string[])];
  if ((context === "tabs" && !tabIds.length) || (context !== "tabs" && tabIds.length)) {
    throw new Error("Selecione o contexto que deseja autorizar.");
  }
  if (request.mode === "research" && context === "none") throw new Error("A pesquisa local precisa de uma fonte autorizada.");
  const question = request.question.trim();
  if (request.operation === "question" && !question) throw new Error("Digite uma pergunta.");
  return {id: request.id, mode: request.mode, operation: request.operation as AiOperation, context, question, tabIds};
}
