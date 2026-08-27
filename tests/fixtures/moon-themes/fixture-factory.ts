import { createHash, generateKeyPairSync, sign } from "node:crypto";

interface FixtureOptions {
  readonly theme?: unknown;
  readonly assets?: Readonly<Record<string, { readonly bytes: Uint8Array; readonly mime: string }>>;
  readonly extraEntries?: Readonly<Record<string, Uint8Array>>;
  readonly minimumVersion?: string;
  readonly version?: string;
  readonly corruptHash?: boolean;
  readonly corruptSignature?: boolean;
}

function crc32(input: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of input) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Readonly<Record<string, Uint8Array>>): Uint8Array {
  const localParts: Buffer[] = []; const centralParts: Buffer[] = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const filename = Buffer.from(name); const content = Buffer.from(value); const checksum = crc32(content);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(content.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(filename.length, 26);
    localParts.push(local, filename, content);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centralParts.push(central, filename); offset += local.length + filename.length + content.length;
  }
  const central = Buffer.concat(centralParts); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Uint8Array.from(Buffer.concat([...localParts, central, end]));
}

export function moonThemeFixture(options: FixtureOptions = {}): Uint8Array {
  const themeBytes = Buffer.from(JSON.stringify(options.theme ?? { colors: { accent: "#7c5cff", background: "#101018" }, shape: { radius: 14 } }));
  const assets = options.assets ?? {};
  const files = [{ path: "theme.json", bytes: themeBytes.length, mime: "application/json", sha256: createHash("sha256").update(themeBytes).digest("hex") }, ...Object.entries(assets).map(([path, asset]) => ({ path, bytes: asset.bytes.length, mime: asset.mime, sha256: createHash("sha256").update(asset.bytes).digest("hex") }))];
  if (options.corruptHash) files[0] = { ...files[0]!, sha256: "0".repeat(64) };
  const version = options.version ?? "1.0.0";
  const manifestBytes = Buffer.from(JSON.stringify({ format: "moon-theme", schemaVersion: 1, id: "fixture.theme", slug: "fixture-theme", name: "Fixture Theme", version, author: "Moon Tests", description: "Fixture seguro", license: "MIT", minMoonVersion: options.minimumVersion ?? "0.1.0", capabilities: ["appearance"], assets: files, marketplace: { themeId: "fixture-market-theme", releaseId: `fixture-release-${version}` } }));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" }); const signature = sign(null, manifestBytes, privateKey);
  if (options.corruptSignature) signature[0] = signature[0]! ^ 0xff;
  const signatureBytes = Buffer.from(JSON.stringify({ algorithm: "Ed25519", keyId: createHash("sha256").update(publicDer).digest("hex"), publicKey: publicDer.toString("base64"), signature: signature.toString("base64") }));
  return zip({ "manifest.json": manifestBytes, "theme.json": themeBytes, "SIGNATURE.json": signatureBytes, ...Object.fromEntries(Object.entries(assets).map(([path, asset]) => [path, asset.bytes])), ...options.extraEntries });
}
