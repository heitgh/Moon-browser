import { lstat, open } from "node:fs/promises";
import { basename, extname, isAbsolute } from "node:path";

export interface AiModelFile {
  readonly path: string;
  readonly name: string;
  readonly bytes: number;
  readonly identity: string;
}

export async function inspectAiModel(path: string): Promise<AiModelFile> {
  if (!isAbsolute(path) || extname(path).toLowerCase() !== ".gguf") throw new Error("Escolha um arquivo GGUF local.");
  const first = await lstat(path);
  if (!first.isFile() || first.size < 1024 * 1024 || first.size > 2 * 1024 ** 3) {
    throw new Error("Use um arquivo GGUF regular entre 1 MiB e 2 GiB.");
  }
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    const header = Buffer.alloc(8);
    await handle.read(header, 0, header.length, 0);
    if (!info.isFile() || info.ino !== first.ino || info.dev !== first.dev ||
        header.toString("ascii", 0, 4) !== "GGUF" || ![2, 3].includes(header.readUInt32LE(4))) {
      throw new Error("O arquivo não tem um cabeçalho GGUF compatível.");
    }
    return {path, name: basename(path), bytes: info.size, identity: [info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs].join(":")};
  } finally {
    await handle.close();
  }
}

export function parseAiModelFile(value: unknown): AiModelFile | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object") throw new Error("Modelo local inválido.");
  const file = value as Record<string, unknown>;
  if (typeof file.path !== "string" || file.path.length > 4096 || !isAbsolute(file.path) || extname(file.path).toLowerCase() !== ".gguf" ||
      typeof file.name !== "string" || file.name !== basename(file.path) ||
      typeof file.bytes !== "number" || !Number.isSafeInteger(file.bytes) || file.bytes < 1024 * 1024 || file.bytes > 2 * 1024 ** 3 ||
      typeof file.identity !== "string" || file.identity.length > 160) throw new Error("Modelo local inválido.");
  return {path: file.path, name: file.name, bytes: file.bytes, identity: file.identity};
}
