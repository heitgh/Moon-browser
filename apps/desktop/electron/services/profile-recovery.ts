// Nexus Inc. — offline recovery; no damaged SQLite file is ever overwritten in place.
import { randomUUID } from "node:crypto";
import { cp, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { BetterSqliteConnection } from "../../../../packages/storage/adapters/better-sqlite-connection.js";
import { ProfileStorage } from "./profile-storage.js";
import { validateLocalProfileSummary, type LocalProfileSummary } from "../../../../packages/ipc/local-profile-contract.js";

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

  // A truly new profile must receive a new identifier and therefore a new
  // Chromium partition. Reinitializing the old "default" directory would
  // silently share cookies and authenticated sessions with the damaged profile.
  async createFresh(registryDirectory: string): Promise<string> {
    const indexPath = join(registryDirectory, "index.json");
    let existing: readonly LocalProfileSummary[];
    try {
      const raw = JSON.parse(await readFile(indexPath, "utf8")) as Record<string, unknown>;
      if (raw.version !== 1 || raw.migratedLegacyDefault !== true || !Array.isArray(raw.profiles))
        throw new TypeError("Registro de perfis incompatível.");
      existing = raw.profiles.map(validateLocalProfileSummary);
      if (existing.filter(item => item.default && item.kind === "persistent").length !== 1)
        throw new TypeError("Registro de perfis inconsistente.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("O registro de perfis está danificado. Exporte os arquivos antes de tentar uma reconstrução manual.", { cause: error });
      const now = Date.now();
      existing = [{ id: "default", name: "Padrão (preservado)", avatar: "moon", color: "#8b5cf6",
        kind: "persistent", default: true, createdAt: now, lastUsedAt: now }];
    }

    const id = `profile-${randomUUID()}`;
    const directory = join(registryDirectory, id);
    const now = Date.now();
    const next: LocalProfileSummary = {
      id, name: "Perfil recuperado", avatar: "moon", color: "#8b5cf6",
      kind: "persistent", default: true, createdAt: now, lastUsedAt: now
    };
    await mkdir(registryDirectory, { recursive: true, mode: 0o700 });
    const storage = new ProfileStorage(directory);
    try {
      await storage.open();
      await storage.close();
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }

    const backupIndex = `${indexPath}.preserved-${Date.now()}-${randomUUID()}`;
    const temporary = `${indexPath}.tmp-${randomUUID()}`;
    try {
      if ((await stat(indexPath).catch(() => undefined))?.isFile()) await copyFile(indexPath, backupIndex);
      await writeFile(temporary, JSON.stringify({
        version: 1, migratedLegacyDefault: true,
        profiles: [...existing.map(item => ({ ...item, default: false })), next]
      }, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, indexPath);
      return id;
    } catch (error) {
      await rm(temporary, { force: true });
      // No registry was committed, so the new independent profile is not live.
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
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
