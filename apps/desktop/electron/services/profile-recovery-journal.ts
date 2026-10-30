// Nexus Inc. — fail closed when a profile replacement was interrupted.
import { readFile, lstat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export function recoveryJournalPath(profileDirectory: string): string {
  const original = resolve(profileDirectory);
  return join(dirname(original), `${basename(original)}.recovery-pending.json`);
}

export async function readRecoveryJournal(
  profileDirectory: string,
): Promise<{ preservedPath: string; originalIntact: boolean } | null> {
  const path = recoveryJournalPath(profileDirectory);
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!info.isFile() || info.size > 4096)
    throw new Error("Registro de recuperação inválido.");
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  const record = value as { version?: unknown; preservedPath?: unknown };
  if (
    !record ||
    record.version !== 1 ||
    typeof record.preservedPath !== "string"
  )
    throw new Error("Registro de recuperação inválido.");
  const original = resolve(profileDirectory);
  const preserved = resolve(record.preservedPath);
  const prefix = basename(original) + ".preserved-";
  if (
    dirname(preserved) !== dirname(original) ||
    !basename(preserved).startsWith(prefix) ||
    !/^\d+-[a-f0-9-]{36}$/.test(basename(preserved).slice(prefix.length))
  )
    throw new Error("Destino de recuperação inválido.");
  try {
    if (!(await lstat(preserved)).isDirectory())
      throw new Error("Perfil preservado indisponível.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // The process may stop after writing the intent but before the first rename.
    if ((await lstat(original)).isDirectory())
      return { preservedPath: preserved, originalIntact: true };
    throw new Error("Recuperação pendente sem perfil preservado.", {
      cause: error,
    });
  }
  return { preservedPath: preserved, originalIntact: false };
}
