// Nexus Inc. — offline recovery; no damaged SQLite file is ever overwritten in place.
import { randomUUID } from "node:crypto";
import { cp, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile, realpath, lstat, open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { BetterSqliteConnection } from "../../../../packages/storage/adapters/better-sqlite-connection.js";
import { ProfileStorage } from "./profile-storage.js";
import { parseLocalProfileId, validateLocalProfileSummary, type LocalProfileSummary } from "../../../../packages/ipc/local-profile-contract.js";
import { readRecoveryJournal, recoveryJournalPath } from "./profile-recovery-journal.js";

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
  #busy = false;
  constructor(readonly profileDirectory: string) {}

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#busy) throw new Error("Aguarde a recuperação em andamento.");
    this.#busy = true;
    try { return await operation(); }
    finally { this.#busy = false; }
  }

  async listBackups(): Promise<readonly RecoveryBackup[]> {
    const pending = await readRecoveryJournal(this.profileDirectory);
    const sourceDirectory = pending && !pending.originalIntact ? pending.preservedPath : this.profileDirectory;
    const results: RecoveryBackup[] = [];
    for (const source of ["migration", "update"] as const) {
      const { directory, pattern } = SOURCES[source];
      for (const entry of await readdir(join(sourceDirectory, directory)).catch(() => [])) {
        if (!pattern.test(entry)) continue;
        const path = join(sourceDirectory, directory, entry);
        const info = await lstat(path).catch(() => undefined);
        if (!info?.isFile() || !(await verifyDatabase(path))) continue;
        results.push({ id: `${source}/${entry}`, source, createdAt: info.mtimeMs });
      }
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  async restoreBackup(id: string): Promise<string> {
    return this.#exclusive(async () => {
    await this.#recoverInterrupted();
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
    });
  }

  // A truly new profile must receive a new identifier and therefore a new
  // Chromium partition. Reinitializing the old "default" directory would
  // silently share cookies and authenticated sessions with the damaged profile.
  async createFresh(registryDirectory: string): Promise<string> {
    return this.#exclusive(async () => {
    await this.#recoverInterrupted();
    const indexPath = join(registryDirectory, "index.json");
    let existing: readonly LocalProfileSummary[];
    try {
      const raw = JSON.parse(await readFile(indexPath, "utf8")) as Record<string, unknown>;
      if (raw.version !== 1 || raw.migratedLegacyDefault !== true || !Array.isArray(raw.profiles))
        throw new TypeError("Registro de perfis incompatível.");
      existing = raw.profiles.map(validateLocalProfileSummary);
      if (existing.filter(item => item.default && item.kind === "persistent").length !== 1)
        throw new TypeError("Registro de perfis inconsistente.");
    } catch {
      // Explicit fresh-profile recovery preserves the original registry below.
      // Rebuild only identities from valid directory names, never delete data.
      const now = Date.now();
      existing = [{ id: "default", name: "Padrão (preservado)", avatar: "moon", color: "#8b5cf6",
        kind: "persistent", default: true, createdAt: now, lastUsedAt: now }];
      for (const entry of await readdir(registryDirectory, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory() || !entry.name.startsWith("profile-")) continue;
        try { parseLocalProfileId(entry.name); } catch { continue; }
        existing = [...existing, { id: entry.name, name: "Perfil preservado", avatar: "moon", color: "#8b5cf6",
          kind: "persistent", default: false, createdAt: now, lastUsedAt: now }];
      }
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
    });
  }

  // Emergency export is a raw directory copy, not an importable or encrypted archive.
  async exportEmergency(destinationRoot: string): Promise<string> {
    return this.#exclusive(async () => {
    const pending = await readRecoveryJournal(this.profileDirectory);
    const from = await realpath(pending && !pending.originalIntact ? pending.preservedPath : this.profileDirectory);
    const target = await realpath(destinationRoot);
    if (!isAbsolute(destinationRoot) || target === from || target.startsWith(from + sep) || from.startsWith(target + sep))
      throw new Error("Escolha uma pasta fora do diretório do perfil.");
    if (!(await stat(from)).isDirectory()) throw new Error("Pasta do perfil não encontrada.");
    const destination = join(target, `moon-emergency-${Date.now()}-${randomUUID()}`);
    await cp(from, destination, { recursive: true, errorOnExist: true, force: false });
    return destination;
    });
  }

  async #replacePreservingOld(operation: (preserved: string) => Promise<void>): Promise<string> {
    const original = resolve(this.profileDirectory);
    if (!(await stat(original).catch(() => undefined))?.isDirectory()) throw new Error("O perfil original não está disponível.");
    const preserved = join(dirname(original), `${basename(original)}.preserved-${Date.now()}-${randomUUID()}`);
    const journal = recoveryJournalPath(original);
    const handle = await open(journal, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify({version: 1, preservedPath: preserved})); await handle.sync(); }
    catch (error) { await handle.close(); await rm(journal, {force: true}); throw error; }
    finally { await handle.close(); }
    try { await rename(original, preserved); }
    catch (error) { await rm(journal, {force: true}); throw error; }
    try {
      await operation(preserved);
      await rm(journal);
      return preserved;
    } catch (error) {
      await rm(original, { recursive: true, force: true });
      await rename(preserved, original);
      await rm(journal);
      throw error;
    }
  }

  async #recoverInterrupted(): Promise<void> {
    const pending = await readRecoveryJournal(this.profileDirectory);
    if (!pending) return;
    if (pending.originalIntact) { await rm(recoveryJournalPath(this.profileDirectory)); return; }
    const original = resolve(this.profileDirectory);
    // Never delete a partial replacement: retain it separately for inspection.
    if (await lstat(original).catch(() => undefined)) await rename(original, `${original}.incomplete-${Date.now()}-${randomUUID()}`);
    await rename(pending.preservedPath, original);
    await rm(recoveryJournalPath(original));
  }
}
