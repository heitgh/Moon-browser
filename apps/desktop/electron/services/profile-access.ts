// Nexus Inc. — application access gate; this does not encrypt profile contents.
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseLocalProfileId } from "../../../../packages/ipc/local-profile-contract.js";

interface AccessRecord {
  version: 1; salt: string; key: string; idleMinutes: number; lockOnSystem: boolean;
  attempts: number; retryAt: number;
}
export interface ProfileAccessStatus {
  enabled: boolean; locked: boolean; idleMinutes: number; lockOnSystem: boolean;
  supportsSystemLock: boolean; retryAfterMs: number;
}
function password(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 1024) throw new Error("Use uma senha de 8 a 1024 caracteres.");
  return value;
}
async function derive(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(value, salt, 64,
    { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

export class ProfileAccessService {
  readonly #records = new Map<string, AccessRecord | null>();
  readonly #unlocked = new Set<string>();
  readonly #locking = new Set<string>();
  readonly #busy = new Set<string>();
  readonly #listeners = new Set<(id: string) => void>();
  constructor(readonly directory: string, readonly platform = process.platform, readonly now = Date.now) {}
  async load(id: string): Promise<void> {
    parseLocalProfileId(id);
    if (this.#records.has(id)) return;
    let record: AccessRecord | null = null;
    try {
      const handle = await open(this.#path(id), "r");
      let raw: string;
      try {
        if ((await handle.stat()).size > 4096) throw new Error("Proteção de perfil inválida: arquivo muito grande.");
        raw = await handle.readFile("utf8");
      } finally { await handle.close(); }
      const value = JSON.parse(raw) as AccessRecord;
      if (!value || value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{128}$/.test(value.key)
        || !Number.isInteger(value.idleMinutes) || value.idleMinutes < 0 || value.idleMinutes > 240
        || typeof value.lockOnSystem !== "boolean" || !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > 16
        || !Number.isSafeInteger(value.retryAt) || value.retryAt < 0) throw new Error("Proteção de perfil inválida. Preserve os arquivos e restaure sua configuração de segurança.");
      record = {...value, retryAt: Math.min(value.retryAt, this.now() + 30_000)};
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    this.#records.set(id, record);
    if (!record) this.#unlocked.add(id);
  }
  async protectedProfileIds(): Promise<readonly string[]> {
    let names: string[];
    try { names = await readdir(this.directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    if (names.length > 4096) throw new Error("Registro de segurança grande demais. Preserve os arquivos.");
    const ids = names.filter(name => name.endsWith(".json")).map(name => parseLocalProfileId(name.slice(0, -5))).sort();
    for (const id of ids) await this.load(id);
    return ids.filter(id => Boolean(this.#records.get(id)));
  }
  status(id: string): ProfileAccessStatus {
    if (!this.#records.has(id)) throw new Error("Perfil de segurança não inicializado.");
    const record = this.#records.get(id);
    return {enabled: Boolean(record), locked: !this.#unlocked.has(id), idleMinutes: record?.idleMinutes ?? 0,
      lockOnSystem: record?.lockOnSystem ?? false, supportsSystemLock: this.platform === "win32" || this.platform === "darwin",
      retryAfterMs: Math.max(0, (record?.retryAt ?? 0) - this.now())};
  }
  assertUnlocked(id: string): void { if (!this.#unlocked.has(id)) throw new Error("O perfil está bloqueado."); }
  onLock(listener: (id: string) => void): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  beginLock(id: string): boolean {
    if (this.#busy.has(id) || !this.#records.get(id) || !this.#unlocked.has(id)) return false;
    this.#unlocked.delete(id); this.#locking.add(id);
    for (const listener of this.#listeners) {
      try { listener(id); } catch { /* A consumer failure must not reverse the access gate. */ }
    }
    return true;
  }
  finishLock(id: string): void { this.#locking.delete(id); }
  async unlock(id: string, value: unknown): Promise<boolean> {
    return this.#exclusive(id, async () => {
      if (this.#locking.has(id)) throw new Error("O perfil está sendo bloqueado. Aguarde a gravação da sessão.");
      if (!(await this.#verify(id, value))) return false;
      this.#unlocked.add(id); return true;
    });
  }
  async enable(id: string, value: unknown): Promise<void> {
    return this.#exclusive(id, async () => {
      this.assertUnlocked(id);
      if (this.#records.get(id)) throw new Error("A proteção já está ativa. Use alterar senha.");
      const salt = randomBytes(16); const key = await derive(password(value), salt);
      try { await this.#save(id, {version: 1, salt: salt.toString("hex"), key: key.toString("hex"), idleMinutes: 0, lockOnSystem: false, attempts: 0, retryAt: 0}); }
      finally { key.fill(0); }
    });
  }
  async change(id: string, current: unknown, next: unknown): Promise<void> {
    return this.#exclusive(id, async () => {
      this.assertUnlocked(id);
      if (!(await this.#verify(id, current))) throw new Error("Senha atual incorreta.");
      const previous = this.#records.get(id)!;
      const salt = randomBytes(16); const key = await derive(password(next), salt);
      try { await this.#save(id, {...previous, salt: salt.toString("hex"), key: key.toString("hex"), attempts: 0, retryAt: 0}); }
      finally { key.fill(0); }
    });
  }
  async disable(id: string, current: unknown): Promise<void> {
    return this.#exclusive(id, async () => {
      this.assertUnlocked(id);
      if (!(await this.#verify(id, current))) throw new Error("Senha atual incorreta.");
      await rm(this.#path(id)); this.#records.set(id, null);
    });
  }
  async configure(id: string, current: unknown, idleMinutes: unknown, lockOnSystem: unknown): Promise<void> {
    return this.#exclusive(id, async () => {
      this.assertUnlocked(id);
      if (!Number.isInteger(idleMinutes) || (idleMinutes as number) < 0 || (idleMinutes as number) > 240 || typeof lockOnSystem !== "boolean") throw new Error("Configuração de bloqueio inválida.");
      if (lockOnSystem && !this.status(id).supportsSystemLock) throw new Error("Bloqueio pela tela do sistema não é suportado nesta plataforma.");
      if (!(await this.#verify(id, current))) throw new Error("Senha atual incorreta.");
      await this.#save(id, {...this.#records.get(id)!, idleMinutes: idleMinutes as number, lockOnSystem});
    });
  }
  async #verify(id: string, value: unknown): Promise<boolean> {
    const record = this.#records.get(id);
    if (!record) throw new Error("A proteção não está ativa.");
    const remaining = this.status(id).retryAfterMs;
    if (remaining > 0) throw new Error(`Aguarde ${Math.ceil(remaining / 1000)} segundo(s) antes de tentar novamente.`);
    if (typeof value !== "string" || value.length > 1024) throw new Error("Senha inválida.");
    const key = await derive(value, Buffer.from(record.salt, "hex"));
    let valid: boolean;
    try { valid = timingSafeEqual(key, Buffer.from(record.key, "hex")); }
    finally { key.fill(0); }
    const attempts = valid ? 0 : Math.min(16, record.attempts + 1);
    await this.#save(id, {...record, attempts, retryAt: valid ? 0 : this.now() + Math.min(30_000, 250 * 2 ** Math.min(attempts - 1, 7))});
    return valid;
  }
  async #save(id: string, record: AccessRecord): Promise<void> {
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    const path = this.#path(id); const temporary = `${path}.tmp-${randomUUID()}`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, path); this.#records.set(id, record);
    }
    finally { await rm(temporary, {force: true}); }
  }
  #path(id: string): string { return join(this.directory, parseLocalProfileId(id) + ".json"); }
  async #exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (!this.#records.has(id)) throw new Error("Perfil de segurança não inicializado.");
    if (this.#busy.has(id)) throw new Error("Aguarde a operação de segurança em andamento.");
    this.#busy.add(id); try { return await operation(); } finally { this.#busy.delete(id); }
  }
}
