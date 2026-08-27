import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { dialog } from "electron";
import { validateMoonTheme, type MoonThemeTokens, type ValidatedMoonTheme } from "../../../../packages/theme-contract/index.js";
import type { ThemeRecord } from "../../../../packages/storage/repositories/theme-repository.js";
import type { ProfileStorage } from "./profile-storage.js";

const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;

export interface MoonThemeSummary {
  readonly id: string;
  readonly packageId: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly trust: "official" | "local";
  readonly active: boolean;
  readonly installedAt: number;
}

export interface MoonThemePreview extends MoonThemeSummary {
  readonly intentId: string;
  readonly description?: string;
  readonly changes: readonly string[];
  readonly tokens: MoonThemeTokens;
  readonly wallpaperData?: string;
}

interface PendingTheme { readonly directory: string; readonly validated: ValidatedMoonTheme; readonly createdAt: number; }

export class MoonThemeService {
  readonly #pending = new Map<string, PendingTheme>();
  readonly #quarantine: string;
  readonly #themes: string;

  constructor(readonly profile: ProfileStorage, readonly moonVersion: string, readonly officialKeyIds: ReadonlySet<string> = new Set()) {
    this.#quarantine = join(profile.profileDirectory, "theme-quarantine");
    this.#themes = join(profile.profileDirectory, "moon-themes");
  }

  async importFromDialog(): Promise<MoonThemePreview | null> {
    const result = await dialog.showOpenDialog({ title: "Importar Moon Theme", properties: ["openFile"], filters: [{ name: "Moon Theme", extensions: ["moontheme"] }] });
    const path = result.filePaths[0]; if (result.canceled || !path) return null;
    const archive = await readFile(path); if (archive.length > MAX_ARCHIVE_BYTES) throw new Error("O tema excede 8 MiB.");
    return this.stage(archive);
  }

  async stage(archive: Uint8Array): Promise<MoonThemePreview> {
    if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new Error("O tema excede 8 MiB.");
    const validated = validateMoonTheme(archive, this.moonVersion, this.officialKeyIds);
    const intentId = randomUUID(); const directory = join(this.#quarantine, intentId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await this.#writeEntries(directory, validated); await writeFile(join(directory, "PACKAGE.moontheme"), archive, { mode: 0o600 }); }
    catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
    this.#pending.set(intentId, { directory, validated, createdAt: Date.now() });
    return this.#preview(intentId, this.#pending.get(intentId)!);
  }

  async cancel(intentId: string): Promise<void> {
    const pending = this.#requirePending(intentId); this.#pending.delete(intentId);
    await this.#removePrivateDirectory(pending.directory, this.#quarantine);
  }

  async confirm(intentId: string): Promise<MoonThemeSummary> {
    const pending = this.#requirePending(intentId); const { manifest, tokens, trust, keyId } = pending.validated;
    const now = Date.now(); const id = `moontheme:${manifest.id}:${manifest.version}:${randomUUID()}`;
    const destination = join(this.#themes, id.replaceAll(":", "_")); await mkdir(this.#themes, { recursive: true, mode: 0o700 });
    await rename(pending.directory, destination);
    try {
      const record: ThemeRecord = { id, name: manifest.name, tokens: JSON.stringify(tokens), builtin: false, source: "moontheme", packageId: manifest.id, version: manifest.version, author: manifest.author, trust, keyId, assetDirectory: destination, active: false, createdAt: now, updatedAt: now };
      await this.profile.saveTheme(record); this.#pending.delete(intentId); return this.#summary(record);
    } catch (error) { await this.#removePrivateDirectory(destination, this.#themes); throw error; }
  }

  async list(): Promise<readonly MoonThemeSummary[]> {
    return (await this.profile.listThemes()).filter(theme => theme.source === "moontheme").map(theme => this.#summary(theme)).sort((a, b) => Number(b.active) - Number(a.active) || b.installedAt - a.installedAt);
  }

  async apply(id: string): Promise<{ readonly summary: MoonThemeSummary; readonly tokens: MoonThemeTokens; readonly wallpaperData?: string }> {
    const record = await this.#record(id); const tokens = JSON.parse(record.tokens) as MoonThemeTokens;
    return { summary: this.#summary(record), tokens, ...(await this.#wallpaperData(record, tokens)) };
  }

  async activate(id: string): Promise<MoonThemeSummary> {
    const record = await this.#record(id); const siblings = (await this.profile.listThemes()).filter(theme => theme.source === "moontheme" && theme.packageId === record.packageId); const now = Date.now();
    for (const theme of siblings) if (theme.active !== (theme.id === id)) await this.profile.saveTheme({ ...theme, active: theme.id === id, updatedAt: now });
    return this.#summary({ ...record, active: true, updatedAt: now });
  }

  async rollback(packageId: string): Promise<{ readonly summary: MoonThemeSummary; readonly tokens: MoonThemeTokens; readonly wallpaperData?: string }> {
    const versions = (await this.profile.listThemes()).filter(theme => theme.source === "moontheme" && theme.packageId === packageId).sort((a, b) => b.createdAt - a.createdAt);
    const current = versions.find(theme => theme.active); const previous = versions.find(theme => !theme.active && theme.id !== current?.id); if (!previous) throw new Error("Não existe versão anterior deste tema.");
    return this.apply(previous.id);
  }

  async remove(id: string): Promise<void> {
    const record = await this.#record(id); if (record.active) throw new Error("Aplique outra versão ou faça rollback antes de remover o tema ativo.");
    await this.profile.removeTheme(id); if (record.assetDirectory) await this.#removePrivateDirectory(record.assetDirectory, this.#themes);
  }

  async export(id: string): Promise<boolean> {
    const record = await this.#record(id); if (!record.assetDirectory) throw new Error("Pacote original indisponível.");
    const source = this.#inside(record.assetDirectory, "PACKAGE.moontheme"); const bytes = await readFile(source); validateMoonTheme(bytes, this.moonVersion, this.officialKeyIds);
    const result = await dialog.showSaveDialog({ title: "Exportar Moon Theme", defaultPath: `${record.packageId}-${record.version}.moontheme`, filters: [{ name: "Moon Theme", extensions: ["moontheme"] }] });
    if (result.canceled || !result.filePath) return false; await writeFile(result.filePath, bytes, { mode: 0o600 }); return true;
  }

  #requirePending(intentId: string): PendingTheme { if (!/^[0-9a-f-]{36}$/i.test(intentId)) throw new TypeError("Intent inválido."); const pending = this.#pending.get(intentId); if (!pending || Date.now() - pending.createdAt > 30 * 60_000) throw new Error("A prévia expirou; importe o tema novamente."); return pending; }
  async #record(id: string): Promise<ThemeRecord> { if (typeof id !== "string" || id.length > 200) throw new TypeError("Tema inválido."); const record = await this.profile.getTheme(id); if (!record || record.source !== "moontheme" || !record.packageId || !record.version || !record.author || !record.trust) throw new Error("Tema não encontrado."); return record; }
  #summary(record: ThemeRecord): MoonThemeSummary { return { id: record.id, packageId: record.packageId!, name: record.name, version: record.version!, author: record.author!, trust: record.trust!, active: record.active === true, installedAt: record.createdAt }; }
  async #writeEntries(directory: string, validated: ValidatedMoonTheme): Promise<void> { for (const [path, bytes] of validated.entries) { const destination = this.#inside(directory, path); await mkdir(dirname(destination), { recursive: true, mode: 0o700 }); await writeFile(destination, bytes, { mode: 0o600 }); } }
  #inside(base: string, child: string): string { const destination = resolve(base, child); const rel = relative(resolve(base), destination); if (!rel || rel.startsWith("..") || rel.includes(":") || resolve(base, rel) !== destination) throw new Error("Caminho privado inválido."); return destination; }
  async #removePrivateDirectory(directory: string, base: string): Promise<void> { const rel = relative(resolve(base), resolve(directory)); if (!rel || rel.startsWith("..") || rel.includes(":")) throw new Error("Recusa ao remover diretório fora do perfil."); await rm(directory, { recursive: true, force: true }); }
  async #wallpaperData(record: ThemeRecord, tokens: MoonThemeTokens): Promise<{ readonly wallpaperData?: string }> { const asset = tokens.wallpaper?.asset; if (!asset || !record.assetDirectory) return {}; const path = this.#inside(record.assetDirectory, asset); const bytes = await readFile(path); const extension = asset.split(".").at(-1)?.toLowerCase(); const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "svg" ? "image/svg+xml" : "image/jpeg"; return { wallpaperData: `data:${mime};base64,${bytes.toString("base64")}` }; }
  async #preview(intentId: string, pending: PendingTheme): Promise<MoonThemePreview> { const { manifest, tokens, trust } = pending.validated; const wallpaper = tokens.wallpaper?.asset ? pending.validated.entries.get(tokens.wallpaper.asset) : undefined; const mime = tokens.wallpaper?.asset.endsWith(".png") ? "image/png" : tokens.wallpaper?.asset.endsWith(".webp") ? "image/webp" : tokens.wallpaper?.asset.endsWith(".svg") ? "image/svg+xml" : "image/jpeg"; return { id: `pending:${intentId}`, intentId, packageId: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, trust, active: false, installedAt: pending.createdAt, ...(manifest.description ? { description: manifest.description } : {}), changes: Object.keys(tokens), tokens, ...(wallpaper ? { wallpaperData: `data:${mime};base64,${Buffer.from(wallpaper).toString("base64")}` } : {}) }; }
}
