import { createHash, createPublicKey, verify } from "node:crypto";
import { readMoonThemeArchive } from "./archive.js";
import { MOON_THEME_FORMAT, MOON_THEME_SCHEMA_VERSION, MoonThemeValidationError, type MoonThemeFileDescriptor, type MoonThemeManifest, type MoonThemeSignature, type MoonThemeTokens, type ValidatedMoonTheme } from "./types.js";

const CORE_FILES = new Set(["manifest.json", "theme.json", "SIGNATURE.json"]);
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", json: "application/json" };
const ID_PATTERN = /^[a-z0-9][a-z0-9.-]{2,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const COLOR_PATTERN = /^(?:#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/;

function fail(code: string, message: string): never { throw new MoonThemeValidationError(code, message); }
function object(value: unknown, code = "schema"): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, "Objeto JSON inválido."); return value as Record<string, unknown>; }
function exact(value: Record<string, unknown>, allowed: readonly string[]): void { const unknown = Object.keys(value).find(key => !allowed.includes(key)); if (unknown) fail("schema", `Campo não permitido: ${unknown}.`); }
function text(value: unknown, field: string, maximum = 160): string { if (typeof value !== "string" || value.length === 0 || value.length > maximum) fail("schema", `${field} inválido.`); return value; }
function numberRange(value: unknown, field: string, min: number, max: number): number { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail("schema", `${field} fora do intervalo.`); return value; }
function parseJson(bytes: Uint8Array, field: string): unknown { try { return JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { fail("json", `${field} não contém JSON válido.`); } }
function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function compareVersion(left: string, right: string): number { const a = left.split("-")[0]!.split(".").map(Number); const b = right.split("-")[0]!.split(".").map(Number); for (let index = 0; index < 3; index += 1) { const difference = (a[index] ?? 0) - (b[index] ?? 0); if (difference) return difference; } return 0; }

function manifestOf(value: unknown): MoonThemeManifest {
  const root = object(value); exact(root, ["format", "schemaVersion", "id", "slug", "name", "version", "author", "description", "license", "minMoonVersion", "maxMoonVersion", "capabilities", "assets", "marketplace"]);
  if (root.format !== MOON_THEME_FORMAT || root.schemaVersion !== MOON_THEME_SCHEMA_VERSION) fail("format", "Formato ou versão de esquema incompatível.");
  const id = text(root.id, "id", 64); if (!ID_PATTERN.test(id)) fail("schema", "ID de tema inválido.");
  const version = text(root.version, "version", 64); if (!VERSION_PATTERN.test(version)) fail("schema", "Versão semântica inválida.");
  const slug = text(root.slug, "slug", 64); if (!ID_PATTERN.test(slug)) fail("schema", "Slug de tema inválido.");
  const minVersion = text(root.minMoonVersion, "minMoonVersion", 64); if (!VERSION_PATTERN.test(minVersion)) fail("schema", "Versão mínima inválida.");
  const maxVersion = root.maxMoonVersion === undefined ? undefined : text(root.maxMoonVersion, "maxMoonVersion", 64); if (maxVersion && !VERSION_PATTERN.test(maxVersion)) fail("schema", "Versão máxima inválida.");
  const allowedCapabilities = new Set(["appearance", "wallpaper", "typography", "icons", "layout"]); if (!Array.isArray(root.capabilities) || root.capabilities.length > 5 || root.capabilities.some(value => typeof value !== "string" || !allowedCapabilities.has(value))) fail("schema", "Capabilities inválidas.");
  const marketplace = object(root.marketplace); exact(marketplace, ["themeId", "releaseId"]);
  if (!Array.isArray(root.assets) || root.assets.length === 0 || root.assets.length > 17) fail("schema", "Lista de assets inválida.");
  const assets: MoonThemeFileDescriptor[] = root.assets.map(candidate => {
    const item = object(candidate); exact(item, ["path", "sha256", "bytes", "mime"]);
    const path = text(item.path, "files.path", 240); const hash = text(item.sha256, "files.sha256", 64).toLowerCase();
    if (!HASH_PATTERN.test(hash) || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 0 || Number(item.bytes) > 4 * 1024 * 1024) fail("schema", "Descritor de arquivo inválido.");
    return { path, sha256: hash, bytes: Number(item.bytes), mime: text(item.mime, "files.mime", 80) };
  });
  if (new Set(assets.map(file => file.path)).size !== assets.length || !assets.some(file => file.path === "theme.json")) fail("schema", "Assets obrigatórios ausentes ou duplicados.");
  return { format: MOON_THEME_FORMAT, schemaVersion: MOON_THEME_SCHEMA_VERSION, id, slug, name: text(root.name, "name"), version, author: text(root.author, "author"), ...(root.description === undefined ? {} : { description: text(root.description, "description", 500) }), license: text(root.license, "license", 80), minMoonVersion: minVersion, ...(maxVersion ? { maxMoonVersion: maxVersion } : {}), capabilities: root.capabilities as MoonThemeManifest["capabilities"], assets, marketplace: { themeId: text(marketplace.themeId, "marketplace.themeId", 100), releaseId: text(marketplace.releaseId, "marketplace.releaseId", 100) } };
}

function signatureOf(value: unknown): MoonThemeSignature {
  const root = object(value); exact(root, ["algorithm", "keyId", "publicKey", "signature"]);
  if (root.algorithm !== "Ed25519") fail("signature", "Algoritmo de assinatura não suportado.");
  return { algorithm: "Ed25519", keyId: text(root.keyId, "keyId", 64), publicKey: text(root.publicKey, "publicKey", 512), signature: text(root.signature, "signature", 512) };
}

function validateMagic(bytes: Uint8Array, mime: string): void {
  const buffer = Buffer.from(bytes);
  const source = buffer.toString("utf8");
  const valid = mime === "application/json" || (mime === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) || (mime === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) || (mime === "image/webp" && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") || (mime === "image/svg+xml" && /^\s*<svg[\s>]/i.test(source));
  if (!valid) fail("mime", "O conteúdo não corresponde ao MIME declarado.");
  if (mime === "image/svg+xml" && /<(?:script|foreignObject|iframe|object|embed|style)\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:)|url\s*\(/i.test(source)) fail("unsafe-svg", "SVG contém conteúdo ativo ou referência externa.");
}

function tokensOf(value: unknown, assets: ReadonlySet<string>): MoonThemeTokens {
  const root = object(value); exact(root, ["colors", "typography", "shape", "glass", "wallpaper", "icons", "layout"]);
  const result: { colors?: MoonThemeTokens["colors"]; typography?: MoonThemeTokens["typography"]; shape?: MoonThemeTokens["shape"]; glass?: MoonThemeTokens["glass"]; wallpaper?: MoonThemeTokens["wallpaper"]; icons?: MoonThemeTokens["icons"]; layout?: MoonThemeTokens["layout"] } = {};
  if (root.colors !== undefined) { const colors = object(root.colors); exact(colors, ["accent", "background", "surface", "surfaceElevated", "text", "textMuted", "border"]); for (const [key, value] of Object.entries(colors)) if (typeof value !== "string" || !COLOR_PATTERN.test(value)) fail("schema", `Cor inválida: ${key}.`); result.colors = colors as MoonThemeTokens["colors"]; }
  if (root.typography !== undefined) { const item = object(root.typography); exact(item, ["family", "scale"]); if (item.family !== undefined && !["system", "serif", "mono"].includes(String(item.family))) fail("schema", "Família tipográfica inválida."); if (item.scale !== undefined && !["compact", "default", "large"].includes(String(item.scale))) fail("schema", "Escala tipográfica inválida."); result.typography = item as MoonThemeTokens["typography"]; }
  if (root.shape !== undefined) { const item = object(root.shape); exact(item, ["radius", "borderWidth", "shadow", "elevation", "spacing", "density"]); if (item.radius !== undefined) numberRange(item.radius, "shape.radius", 0, 32); if (item.borderWidth !== undefined) numberRange(item.borderWidth, "shape.borderWidth", 0, 4); if (item.shadow !== undefined) numberRange(item.shadow, "shape.shadow", 0, 1); if (item.elevation !== undefined) numberRange(item.elevation, "shape.elevation", 0, 2); if (item.spacing !== undefined) numberRange(item.spacing, "shape.spacing", .75, 1.5); if (item.density !== undefined && !["compact", "comfortable"].includes(String(item.density))) fail("schema", "Densidade inválida."); result.shape = item as MoonThemeTokens["shape"]; }
  if (root.glass !== undefined) { const item = object(root.glass); exact(item, ["enabled", "opacity", "blur", "intensity"]); if (item.enabled !== undefined && typeof item.enabled !== "boolean") fail("schema", "glass.enabled inválido."); if (item.opacity !== undefined) numberRange(item.opacity, "glass.opacity", 0, 1); if (item.blur !== undefined) numberRange(item.blur, "glass.blur", 0, 48); if (item.intensity !== undefined) numberRange(item.intensity, "glass.intensity", 0, 40); result.glass = item as MoonThemeTokens["glass"]; }
  if (root.wallpaper !== undefined) { const item = object(root.wallpaper); exact(item, ["asset", "fit", "position", "repeat", "opacity", "blur", "brightness", "contrast", "saturation", "hue", "dim"]); const asset = text(item.asset, "wallpaper.asset", 240); if (!assets.has(asset)) fail("schema", "Wallpaper não declarado."); if (item.fit !== undefined && !["contain", "cover", "fill"].includes(String(item.fit))) fail("schema", "Ajuste de wallpaper inválido."); if (item.position !== undefined) text(item.position, "wallpaper.position", 80); if (item.repeat !== undefined && typeof item.repeat !== "boolean") fail("schema", "wallpaper.repeat inválido."); for (const field of ["opacity", "dim"] as const) if (item[field] !== undefined) numberRange(item[field], `wallpaper.${field}`, 0, 1); if (item.blur !== undefined) numberRange(item.blur, "wallpaper.blur", 0, 40); for (const field of ["brightness", "contrast", "saturation"] as const) if (item[field] !== undefined) numberRange(item[field], `wallpaper.${field}`, field === "saturation" ? 0 : .2, 2); if (item.hue !== undefined) numberRange(item.hue, "wallpaper.hue", -180, 180); result.wallpaper = item as MoonThemeTokens["wallpaper"]; }
  if (root.icons !== undefined) { const item = object(root.icons); exact(item, ["logo", "newTab", "privateTab"]); for (const value of Object.values(item)) if (typeof value !== "string" || !assets.has(value)) fail("schema", "Ícone não declarado."); result.icons = item as MoonThemeTokens["icons"]; }
  if (root.layout !== undefined) { const item = object(root.layout); exact(item, ["sidebar", "tabStyle"]); if (item.sidebar !== undefined && !["left", "right"].includes(String(item.sidebar))) fail("schema", "Posição da sidebar inválida."); if (item.tabStyle !== undefined && !["compact", "comfortable"].includes(String(item.tabStyle))) fail("schema", "Estilo de aba inválido."); result.layout = item as MoonThemeTokens["layout"]; }
  return result;
}

export function validateMoonTheme(input: Uint8Array, moonVersion: string, officialKeyIds: ReadonlySet<string> = new Set()): ValidatedMoonTheme {
  if (!VERSION_PATTERN.test(moonVersion)) fail("version", "Versão atual do Moon inválida.");
  const entries = readMoonThemeArchive(input);
  for (const required of CORE_FILES) if (!entries.has(required)) fail("missing-file", `Arquivo obrigatório ausente: ${required}.`);
  const manifestBytes = entries.get("manifest.json")!;
  const manifest = manifestOf(parseJson(manifestBytes, "manifest.json"));
  if (compareVersion(moonVersion, manifest.minMoonVersion) < 0 || (manifest.maxMoonVersion && compareVersion(moonVersion, manifest.maxMoonVersion) > 0)) fail("incompatible", "Tema incompatível com esta versão do Moon.");
  const signature = signatureOf(parseJson(entries.get("SIGNATURE.json")!, "SIGNATURE.json"));
  let publicKey;
  try { publicKey = createPublicKey({ key: Buffer.from(signature.publicKey, "base64"), format: "der", type: "spki" }); } catch { fail("signature", "Chave pública inválida."); }
  const derivedKeyId = sha256(publicKey.export({ format: "der", type: "spki" }));
  if (derivedKeyId !== signature.keyId || !verify(null, manifestBytes, publicKey, Buffer.from(signature.signature, "base64"))) fail("signature", "Assinatura do manifesto inválida.");
  const declaredPaths = new Set<string>();
  for (const descriptor of manifest.assets) {
    if (CORE_FILES.has(descriptor.path) && descriptor.path !== "theme.json") fail("schema", "O manifesto não pode declarar seus próprios metadados.");
    const bytes = entries.get(descriptor.path); if (!bytes) fail("missing-file", `Arquivo declarado ausente: ${descriptor.path}.`);
    const extension = descriptor.path.split(".").at(-1)?.toLowerCase() ?? ""; const expectedMime = MIME_BY_EXTENSION[extension];
    if (!expectedMime || descriptor.mime !== expectedMime || /\.(?:html?|css|m?js|cjs|woff2?|ttf|otf|exe|dll|so)$/i.test(descriptor.path)) fail("file-type", "Tipo de arquivo não permitido.");
    if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) fail("integrity", `Hash ou tamanho inválido: ${descriptor.path}.`);
    validateMagic(bytes, descriptor.mime); declaredPaths.add(descriptor.path);
  }
  for (const path of entries.keys()) if (!CORE_FILES.has(path) && !declaredPaths.has(path)) fail("undeclared-file", `Arquivo não declarado: ${path}.`);
  const tokens = tokensOf(parseJson(entries.get("theme.json")!, "theme.json"), new Set([...declaredPaths].filter(path => path !== "theme.json")));
  return { manifest, tokens, trust: officialKeyIds.has(signature.keyId) ? "official" : "local", keyId: signature.keyId, entries };
}
