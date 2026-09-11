import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { dialog, nativeImage } from "electron";
import type { WallpaperLibraryItem, WallpaperLibrarySummary, WallpaperLibraryUpdate } from "../../../../packages/ipc/wallpaper-library-contract.js";
import type { WallpaperRecord } from "../../../../packages/storage/repositories/wallpaper-repository.js";
import type { ProfileStorage } from "./profile-storage.js";

const MAX_WALLPAPER_BYTES = 10_000_000;
const MAX_WALLPAPERS = 100;
type ManagedWallpaperRecord = WallpaperRecord & Required<Pick<WallpaperRecord, "thumbnailData" | "mimeType" | "bytes" | "hash">>;

export class WallpaperLibraryService {
  constructor(readonly storage: ProfileStorage) {}

  async list(): Promise<readonly WallpaperLibrarySummary[]> {
    return (await this.storage.listWallpapers()).flatMap(record => isManaged(record) ? [summary(record)] : []);
  }

  async get(id: string): Promise<WallpaperLibraryItem> {
    const record = await this.#require(id);
    return { ...summary(record), data: record.source };
  }

  async importFromDialog(): Promise<WallpaperLibraryItem | null> {
    const picked = await dialog.showOpenDialog({
      title: "Importar wallpaper",
      properties: ["openFile"],
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    const path = picked.filePaths[0];
    if (picked.canceled || !path) return null;
    return this.#storeFile(path);
  }

  async replaceFromDialog(id: string): Promise<WallpaperLibraryItem | null> {
    const current = await this.#require(id);
    const picked = await dialog.showOpenDialog({
      title: `Substituir ${current.name}`,
      properties: ["openFile"],
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    const path = picked.filePaths[0];
    if (picked.canceled || !path) return null;
    return this.#storeFile(path, current);
  }

  async update(update: WallpaperLibraryUpdate): Promise<WallpaperLibrarySummary> {
    const current = await this.#require(update.id);
    const record: ManagedWallpaperRecord = {
      ...current,
      ...(update.name === undefined ? {} : { name: update.name }),
      ...(update.favorite === undefined ? {} : { favorite: update.favorite }),
      ...(update.tags === undefined ? {} : { tags: update.tags }),
      ...(update.fit === undefined ? {} : { fit: update.fit }),
      ...(update.position === undefined ? {} : { position: update.position }),
      ...(update.repeat === undefined ? {} : { repeat: update.repeat }),
      updatedAt: Date.now(),
    };
    await this.storage.saveWallpaper(record);
    return summary(record);
  }

  async remove(id: string): Promise<boolean> {
    await this.#require(id);
    return this.storage.removeWallpaper(id);
  }

  async exportToDialog(id: string): Promise<boolean> {
    const record = await this.#require(id);
    const extension = extensionFor(record.mimeType!);
    const picked = await dialog.showSaveDialog({
      title: "Exportar wallpaper",
      defaultPath: `${safeFilename(record.name)}.${extension}`,
      filters: [{ name: "Imagem", extensions: [extension] }],
    });
    if (picked.canceled || !picked.filePath) return false;
    await writeFile(picked.filePath, dataBuffer(record.source, record.mimeType!));
    return true;
  }

  async #storeFile(path: string, replacing?: WallpaperRecord): Promise<WallpaperLibraryItem> {
    const info = await stat(path);
    if (!info.isFile() || info.size < 1 || info.size > MAX_WALLPAPER_BYTES) throw new Error("O wallpaper deve ser uma imagem PNG, JPEG, WebP ou GIF de até 10 MB.");
    const buffer = await readFile(path);
    const mimeType = imageMime(buffer);
    if (!mimeType) throw new Error("O conteúdo do arquivo não corresponde a PNG, JPEG, WebP ou GIF.");
    const hash = createHash("sha256").update(buffer).digest("hex");
    const records = await this.storage.listWallpapers();
    const duplicate = records.filter(isManaged).find(record => record.hash === hash && record.id !== replacing?.id);
    if (duplicate) return { ...summary(duplicate), data: duplicate.source };
    if (!replacing && records.filter(isManaged).length >= MAX_WALLPAPERS) throw new Error(`A biblioteca atingiu o limite de ${MAX_WALLPAPERS} wallpapers. Exclua um item antes de importar.`);
    const now = Date.now();
    const data = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const record: ManagedWallpaperRecord = {
      id: replacing?.id ?? `wallpaper-${hash.slice(0, 24)}`,
      name: replacing?.name ?? (basename(path, extname(path)).slice(0, 120) || "Wallpaper"),
      source: data,
      type: "image",
      thumbnailData: thumbnailData(buffer, mimeType, data),
      mimeType,
      bytes: buffer.byteLength,
      hash,
      favorite: replacing?.favorite ?? false,
      tags: replacing?.tags ?? [],
      fit: replacing?.fit ?? "cover",
      position: replacing?.position ?? "center",
      repeat: replacing?.repeat ?? false,
      createdAt: replacing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.storage.saveWallpaper(record);
    return { ...summary(record), data };
  }

  async #require(id: string): Promise<ManagedWallpaperRecord> {
    const record = await this.storage.getWallpaper(id);
    if (!record || !isManaged(record)) throw new Error("Wallpaper não encontrado ou precisa ser reimportado.");
    return record;
  }
}

function isManaged(record: WallpaperRecord): record is ManagedWallpaperRecord {
  return record.type === "image" && Boolean(record.thumbnailData && record.mimeType && record.hash && Number.isSafeInteger(record.bytes) && record.bytes! > 0 && record.source.startsWith("data:image/"));
}

function summary(record: ManagedWallpaperRecord): WallpaperLibrarySummary {
  return {
    id: record.id,
    name: record.name,
    thumbnailData: record.thumbnailData,
    mimeType: record.mimeType,
    bytes: record.bytes,
    favorite: record.favorite ?? false,
    tags: record.tags ?? [],
    fit: record.fit ?? "cover",
    position: record.position ?? "center",
    repeat: record.repeat ?? false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? record.createdAt,
  };
}

function imageMime(buffer: Buffer): WallpaperLibrarySummary["mimeType"] | undefined {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
}

function thumbnailData(buffer: Buffer, mimeType: WallpaperLibrarySummary["mimeType"], fallback: string): string {
  try {
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return fallback;
    return image.resize({ width: 320, quality: "good" }).toDataURL();
  } catch {
    return mimeType === "image/gif" || mimeType === "image/webp" ? fallback : fallback;
  }
}

function dataBuffer(data: string, mimeType: string): Buffer {
  const prefix = `data:${mimeType};base64,`;
  if (!data.startsWith(prefix)) throw new Error("Wallpaper armazenado está inválido.");
  return Buffer.from(data.slice(prefix.length), "base64");
}

function extensionFor(mimeType: string): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
}

function safeFilename(value: string): string {
  return Array.from(value, character => character.charCodeAt(0) < 32 ? "-" : character).join("").replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 100) || "moon-wallpaper";
}
