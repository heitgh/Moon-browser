import { inflateRawSync } from "node:zlib";
import { MoonThemeValidationError } from "./types.js";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

function fail(code: string, message: string): never { throw new MoonThemeValidationError(code, message); }

function safePath(value: string): string {
  if (!value || value.length > 240 || value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) fail("unsafe-path", "O pacote contém um caminho inseguro.");
  const parts = value.split("/");
  if (parts.length > 5 || parts.some(part => !part || part === "." || part === "..")) fail("unsafe-path", "O pacote contém travessia ou profundidade excessiva.");
  return value;
}

export function readMoonThemeArchive(input: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const archive = Buffer.from(input);
  if (archive.length === 0 || archive.length > MAX_ARCHIVE_BYTES) fail("archive-size", "O pacote está vazio ou excede 8 MiB.");
  const searchStart = Math.max(0, archive.length - 65_557);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= searchStart; offset -= 1) {
    if (archive.readUInt32LE(offset) === EOCD_SIGNATURE) { eocd = offset; break; }
  }
  if (eocd < 0) fail("invalid-zip", "Diretório ZIP não encontrado.");
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const count = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || count === 0 || count > MAX_FILES || centralOffset + centralSize > eocd) fail("invalid-zip", "Estrutura ZIP não suportada.");

  const entries = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  let totalBytes = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) fail("invalid-zip", "Entrada central inválida.");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedBytes = archive.readUInt32LE(cursor + 20);
    const bytes = archive.readUInt32LE(cursor + 24);
    const nameBytes = archive.readUInt16LE(cursor + 28);
    const extraBytes = archive.readUInt16LE(cursor + 30);
    const commentBytes = archive.readUInt16LE(cursor + 32);
    const externalAttributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameEnd = cursor + 46 + nameBytes;
    if (nameEnd > archive.length || (flags & 0x1) !== 0 || (flags & 0x8) !== 0 || ![0, 8].includes(method)) fail("unsupported-zip", "Criptografia, descriptor de dados ou compressão não suportada.");
    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0o170000) === 0o120000) fail("symlink", "Links simbólicos não são permitidos.");
    const name = safePath(archive.subarray(cursor + 46, nameEnd).toString("utf8"));
    if (name.endsWith("/") || entries.has(name)) fail("invalid-entry", "Diretórios e entradas duplicadas não são permitidos.");
    if (bytes > MAX_FILE_BYTES || compressedBytes > MAX_ARCHIVE_BYTES) fail("zip-bomb", "Uma entrada excede o limite permitido.");
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES || (compressedBytes > 0 && bytes / compressedBytes > 150)) fail("zip-bomb", "Taxa ou volume de descompressão inseguro.");
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) fail("invalid-zip", "Cabeçalho local inválido.");
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localCompressedBytes = archive.readUInt32LE(localOffset + 18);
    const localBytes = archive.readUInt32LE(localOffset + 22);
    const localNameBytes = archive.readUInt16LE(localOffset + 26);
    const localExtraBytes = archive.readUInt16LE(localOffset + 28);
    const localNameEnd = localOffset + 30 + localNameBytes;
    if (localNameEnd > archive.length || safePath(archive.subarray(localOffset + 30, localNameEnd).toString("utf8")) !== name || localFlags !== flags || localMethod !== method || localCompressedBytes !== compressedBytes || localBytes !== bytes) fail("invalid-zip", "Cabeçalhos ZIP divergentes.");
    const dataStart = localOffset + 30 + localNameBytes + localExtraBytes;
    const dataEnd = dataStart + compressedBytes;
    if (dataEnd > archive.length) fail("invalid-zip", "Conteúdo truncado.");
    let content: Buffer;
    try { content = method === 0 ? archive.subarray(dataStart, dataEnd) : inflateRawSync(archive.subarray(dataStart, dataEnd), { maxOutputLength: MAX_FILE_BYTES }); }
    catch { fail("invalid-compression", "Falha ao descomprimir uma entrada."); }
    if (content.length !== bytes) fail("invalid-size", "O tamanho declarado não corresponde ao conteúdo.");
    entries.set(name, Uint8Array.from(content));
    cursor = nameEnd + extraBytes + commentBytes;
  }
  if (cursor !== centralOffset + centralSize) fail("invalid-zip", "O diretório ZIP contém dados inesperados.");
  return entries;
}
