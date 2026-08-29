import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  LOCAL_PROFILE_REGISTRY_VERSION,
  parseCreateLocalProfile,
  parseDeleteLocalProfile,
  parseLocalProfileId,
  parseUpdateLocalProfile,
  validateLocalProfileSummary,
  type CreateLocalProfileRequest,
  type DeleteLocalProfileRequest,
  type LocalProfileSummary,
  type UpdateLocalProfileRequest
} from "../../../../packages/ipc/local-profile-contract.js";
import { ProfileStorage } from "./profile-storage.js";

interface RegistryV1 {
  readonly version: 1;
  readonly migratedLegacyDefault: boolean;
  readonly profiles: readonly LocalProfileSummary[];
}

export interface DeletedLocalProfile { readonly id: string; readonly backupPath?: string; }

export class LocalProfileManager {
  readonly #profiles = new Map<string, LocalProfileSummary>();
  readonly #storages = new Map<string, ProfileStorage>();
  readonly #guestDirectories = new Map<string, string>();

  constructor(readonly profilesDirectory: string, readonly legacyDefaultDirectory: string) {}

  async initialize(): Promise<LocalProfileSummary> {
    await mkdir(this.profilesDirectory, { recursive: true, mode: 0o700 });
    const registry = await this.#readRegistry();
    if (registry) {
      for (const profile of registry.profiles) this.#profiles.set(profile.id, profile);
      const primary = this.#defaultProfile();
      await this.storage(primary.id);
      return primary;
    }
    const now = Date.now();
    const primary: LocalProfileSummary = { id: "default", name: "Padrão", avatar: "moon", color: "#8b5cf6", kind: "persistent", default: true, createdAt: now, lastUsedAt: now };
    this.#profiles.set(primary.id, primary);
    try {
      // Opening the existing database is the validation gate. Its original
      // directory is preserved; only metadata is added after a valid open.
      await this.storage(primary.id);
      await this.#writeRegistry(true);
      return primary;
    } catch (error) {
      this.#profiles.delete(primary.id);
      throw error;
    }
  }

  list(): readonly LocalProfileSummary[] {
    return [...this.#profiles.values()].sort((left, right) => Number(right.default) - Number(left.default) || right.lastUsedAt - left.lastUsedAt);
  }

  require(id: string): LocalProfileSummary {
    const profile = this.#profiles.get(parseLocalProfileId(id));
    if (!profile) throw new Error("Perfil local não encontrado.");
    return profile;
  }

  async storage(id: string): Promise<ProfileStorage> {
    const profile = this.require(id);
    const existing = this.#storages.get(profile.id);
    if (existing) return existing;
    const directory = profile.kind === "guest" ? this.#guestDirectories.get(profile.id) : this.#directoryFor(profile.id);
    if (!directory) throw new Error("Diretório temporário do perfil não está disponível.");
    const storage = new ProfileStorage(directory);
    await storage.open();
    this.#storages.set(profile.id, storage);
    return storage;
  }

  async create(value: CreateLocalProfileRequest): Promise<LocalProfileSummary> {
    const request = parseCreateLocalProfile(value);
    const now = Date.now();
    const profile: LocalProfileSummary = { id: `profile-${randomUUID()}`, ...request, kind: "persistent", default: false, createdAt: now, lastUsedAt: now };
    this.#profiles.set(profile.id, profile);
    try {
      await this.storage(profile.id);
      await this.#writeRegistry(true);
      return profile;
    } catch (error) {
      this.#profiles.delete(profile.id);
      await this.#closeStorage(profile.id);
      throw error;
    }
  }

  async createGuest(): Promise<LocalProfileSummary> {
    const now = Date.now();
    const profile: LocalProfileSummary = { id: `guest-${randomUUID()}`, name: "Convidado", avatar: "person", color: "#64748b", kind: "guest", default: false, createdAt: now, lastUsedAt: now };
    const directory = await mkdtemp(join(tmpdir(), "moon-guest-profile-"));
    this.#profiles.set(profile.id, profile);
    this.#guestDirectories.set(profile.id, directory);
    try { await this.storage(profile.id); return profile; }
    catch (error) { this.#profiles.delete(profile.id); this.#guestDirectories.delete(profile.id); await rm(directory, { recursive: true, force: true }); throw error; }
  }

  async update(value: UpdateLocalProfileRequest): Promise<LocalProfileSummary> {
    const request = parseUpdateLocalProfile(value);
    const current = this.require(request.id);
    if (current.kind === "guest") throw new Error("O perfil convidado é temporário e não pode ser renomeado.");
    const updated: LocalProfileSummary = { ...current, name: request.name, avatar: request.avatar, color: request.color };
    this.#profiles.set(updated.id, updated);
    try { await this.#writeRegistry(true); return updated; }
    catch (error) { this.#profiles.set(current.id, current); throw error; }
  }

  async touch(id: string): Promise<LocalProfileSummary> {
    const current = this.require(id);
    const updated = { ...current, lastUsedAt: Date.now() };
    this.#profiles.set(id, updated);
    if (updated.kind === "persistent") await this.#writeRegistry(true);
    return updated;
  }

  deletionSummary(id: string): { readonly profile: LocalProfileSummary; readonly directoryName: string; readonly includes: readonly string[] } {
    const profile = this.require(id);
    if (profile.default) throw new Error("O perfil padrão não pode ser excluído.");
    return {
      profile,
      directoryName: basename(profile.kind === "guest" ? this.#guestDirectories.get(id) ?? id : this.#directoryFor(id)),
      includes: ["sessões", "temas", "Home", "workspaces", "favoritos", "histórico", "notas", "atalhos", "downloads e preferências"]
    };
  }

  async delete(value: DeleteLocalProfileRequest): Promise<DeletedLocalProfile> {
    const request = parseDeleteLocalProfile(value);
    const summary = this.deletionSummary(request.id);
    if (request.confirmation !== summary.profile.name) throw new Error(`Digite exatamente “${summary.profile.name}” para confirmar.`);
    const directory = summary.profile.kind === "guest" ? this.#guestDirectories.get(summary.profile.id) : this.#directoryFor(summary.profile.id);
    if (!directory) throw new Error("Diretório do perfil não encontrado.");
    let backupPath: string | undefined;
    if (request.backup && summary.profile.kind === "persistent") {
      const backupDirectory = join(this.profilesDirectory, "backups");
      await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
      backupPath = join(backupDirectory, `${summary.profile.id}-${Date.now()}`);
      await cp(directory, backupPath, { recursive: true, errorOnExist: true });
    }
    await this.#closeStorage(summary.profile.id);
    await rm(directory, { recursive: true, force: false });
    this.#profiles.delete(summary.profile.id);
    this.#guestDirectories.delete(summary.profile.id);
    if (summary.profile.kind === "persistent") await this.#writeRegistry(true);
    return { id: summary.profile.id, ...(backupPath ? { backupPath } : {}) };
  }

  async releaseGuest(id: string): Promise<void> {
    const profile = this.#profiles.get(id);
    if (!profile || profile.kind !== "guest") return;
    const directory = this.#guestDirectories.get(id);
    await this.#closeStorage(id);
    this.#profiles.delete(id);
    this.#guestDirectories.delete(id);
    if (directory) await rm(directory, { recursive: true, force: true });
  }

  async close(): Promise<void> {
    for (const id of [...this.#storages.keys()]) await this.#closeStorage(id);
    for (const [id, directory] of this.#guestDirectories) { await rm(directory, { recursive: true, force: true }); this.#profiles.delete(id); }
    this.#guestDirectories.clear();
  }

  #directoryFor(id: string): string { return id === "default" ? this.legacyDefaultDirectory : join(this.profilesDirectory, id); }

  #defaultProfile(): LocalProfileSummary {
    const defaults = this.list().filter(profile => profile.default && profile.kind === "persistent");
    if (defaults.length !== 1) throw new Error("O registro de perfis precisa conter exatamente um perfil padrão.");
    return defaults[0]!;
  }

  async #readRegistry(): Promise<RegistryV1 | undefined> {
    try {
      const value = JSON.parse(await readFile(join(this.profilesDirectory, "index.json"), "utf8")) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Registro de perfis inválido.");
      const record = value as Record<string, unknown>;
      if (record.version !== LOCAL_PROFILE_REGISTRY_VERSION || record.migratedLegacyDefault !== true || !Array.isArray(record.profiles)) throw new TypeError("Versão do registro de perfis não suportada.");
      const profiles = record.profiles.map(validateLocalProfileSummary);
      if (!profiles.length || new Set(profiles.map(profile => profile.id)).size !== profiles.length || profiles.some(profile => profile.kind !== "persistent")) throw new TypeError("Registro de perfis inconsistente.");
      return { version: 1, migratedLegacyDefault: true, profiles };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async #writeRegistry(migratedLegacyDefault: boolean): Promise<void> {
    const path = join(this.profilesDirectory, "index.json");
    const temporary = `${path}.tmp`;
    const registry: RegistryV1 = { version: 1, migratedLegacyDefault, profiles: this.list().filter(profile => profile.kind === "persistent") };
    await writeFile(temporary, JSON.stringify(registry, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  async #closeStorage(id: string): Promise<void> {
    const storage = this.#storages.get(id); if (!storage) return;
    this.#storages.delete(id); await storage.close();
  }
}
