import { utilityProcess } from "electron";
import { fileURLToPath } from "node:url";
import type { AiOperation } from "../../../../packages/ipc/ai-contract.js";

export interface AiProviderInput {
  readonly modelPath: string;
  readonly operation: AiOperation;
  readonly question: string;
  readonly sources: readonly { readonly title: string; readonly text: string }[];
}
export interface AiProvider {
  generate(input: AiProviderInput, options: {
    readonly signal: AbortSignal;
    readonly onChunk: (chunk: string) => void;
    readonly onPid: (pid: number | null) => void;
  }): Promise<string>;
}

export class LocalLlamaProvider implements AiProvider {
  async generate(input: AiProviderInput, options: Parameters<AiProvider["generate"]>[1]): Promise<string> {
    options.signal.throwIfAborted();
    const process = utilityProcess.fork(fileURLToPath(new URL("./ai-worker.js", import.meta.url)), [], {
      serviceName: "Moon Local AI",
      stdio: "ignore"
    });
    return new Promise<string>((resolve, reject) => {
      let result = "";
      let failure: Error | undefined;
      let complete = false;
      const timer = setTimeout(() => {
        failure = new Error("O modelo excedeu o tempo desta tarefa. Tente um modelo menor.");
        process.kill();
      }, 120_000);
      const abort = () => {
        failure = new Error("Tarefa interrompida.");
        process.kill();
      };
      options.signal.addEventListener("abort", abort, {once: true});
      process.on("spawn", () => {
        if (options.signal.aborted) { abort(); return; }
        if (process.pid) options.onPid(process.pid);
        process.postMessage(input);
      });
      process.on("message", (value: unknown) => {
        if (failure || complete || !value || typeof value !== "object") return;
        const message = value as {type?: unknown; text?: unknown};
        if (message.type === "chunk" && typeof message.text === "string" && result.length + message.text.length <= 24_000) {
          result += message.text;
          try { options.onChunk(message.text); }
          catch { abort(); }
        } else if (message.type === "done") {
          complete = true;
        } else if (message.type === "error") {
          failure = new Error("O runtime local não conseguiu usar o modelo. Confira compatibilidade e memória disponível.");
        } else {
          failure = new Error("Resposta inesperada do processo de IA.");
          process.kill();
        }
      });
      process.once("exit", code => {
        clearTimeout(timer);
        options.signal.removeEventListener("abort", abort);
        options.onPid(null);
        if (failure) reject(failure);
        else if (!complete || code !== 0 || !result.trim()) reject(new Error("O processo de IA terminou sem uma resposta válida."));
        else resolve(result);
      });
    });
  }
}
