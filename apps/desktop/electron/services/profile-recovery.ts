// Nexus Inc. — offline recovery; no damaged SQLite file is ever overwritten in place.
import { randomUUID } from "node:crypto";
import { cp, copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { BetterSqliteConnection } from "../../../../packages/storage/adapters/better-sqlite-connection.js";
import { ProfileStorage } from "./profile-storage.js";

export interface RecoveryBackup {
  readonly id: string;
  readonly createdAt: number;
  readonly source: "migration" | "update";
}

const SOURCES = {
  migration: { directory: "migration-backups", pattern: /^before-migration-\d+-[a-f\d-]+\.sqlite3$/ },
  update: { directory: "recovery-backups", pattern: /^before-update-\d+-[a-f\d-]+\.sqlite3$/ }
} as const;

async function verifyDatabase(path: string): Promise<boolean> {
  const connection = new BetterSqliteConnection(path, { readonly: true, fileMustExist: true });
  try { await connection.connect(); return true; }
  catch { return false; }
  finally { await connection.close(); }
}

export class ProfileRecoveryService {
  constructor(readonly profileDirectory: string) {}

  async listBackups(): Promise<readonly RecoveryBackup[]> {
    const results: RecoveryBackup[] = [];
    for (const source of ["migration", "update"] as const) {
      const { directory, pattern } = SOURCES[source];
      for (const entry of await readdir(join(this.profileDirectory, directory)).catch(() => [])) {
        if (!pattern.test(entry)) continue;
        const path = join(this.profileDirectory, directory, entry);
        const info = await stat(path).catch(() => undefined);
        if (!info?.isFile() || !(await verifyDatabase(path))) continue;
        results.push({ id: `${source}/${entry}`, source, createdAt: info.mtimeMs });
      }
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  async restoreBackup(id: string): Promise<string> {
    const selected = (await this.listBackups()).find(item => item.id === id);
    if (!selected) throw new Error("Backup inexistente ou com integridade inválida.");
    return this.#replacePreservingOld(async preserved => {
      await cp(preserved, this.profileDirectory, { recursive: true, errorOnExist: true, force: false });
      const source = SOURCES[selected.source];
      const savedBackup = join(preserved, source.directory, basename(selected.id));
      const target = join(this.profileDirectory, "moon.sqlite3");
      const temporary = `${target}.recovery-${randomUUID()}`;
      await copyFile(savedBackup, temporary);
      await rename(temporary, target);
      await rm(`${target}-wal`, { force: true });
      await rm(`${target}-shm`, { force: true });
      if (!(await verifyDatabase(target))) throw new Error("O banco restaurado não passou na verificação.");
    });
  }

  async createFresh(): Promise<string> {
    return this.#replacePreservingOld(async () => {
      await mkdir(this.profileDirectory, { recursive: true, mode: 0o700 });
      const storage = new ProfileStorage(this.profileDirectory);
      await storage.open();
      await storage.close();
    });
  }

  // Emergency export is a raw directory copy, not an importable or encrypted archive.
  async exportEmergency(destinationRoot: string): Promise<string> {
    const from = resolve(this.profileDirectory);
    const target = resolve(destinationRoot);
    if (!isAbsolute(destinationRoot) || target === from || target.startsWith(from + sep) || from.startsWith(target + sep))
      throw new Error("Escolha uma pasta fora do diretório do perfil.");
    if (!(await stat(from)).isDirectory()) throw new Error("Pasta do perfil não encontrada.");
    const destination = join(target, `moon-emergency-${Date.now()}-${randomUUID()}`);
    await cp(from, destination, { recursive: true, errorOnExist: true, force: false });
    return destination;
  }

  async #replacePreservingOld(operation: (preserved: string) => Promise<void>): Promise<string> {
    const original = resolve(this.profileDirectory);
    if (!(await stat(original).catch(() => undefined))?.isDirectory()) throw new Error("O perfil original não está disponível.");
    const preserved = join(dirname(original), `${basename(original)}.preserved-${Date.now()}-${randomUUID()}`);
    await rename(original, preserved);
    try {
      await operation(preserved);
      return preserved;
    } catch (error) {
      await rm(original, { recursive: true, force: true });
      await rename(preserved, original);
      throw error;
    }
  }
}
