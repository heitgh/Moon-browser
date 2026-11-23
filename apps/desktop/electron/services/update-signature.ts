import { createHash, createPublicKey, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename } from "node:path";

export function appImageAssetName(version: string): string {
  if (!/^v?\d+\.\d+\.\d+(?:-(?:alpha|beta)\.\d+)?$/.test(version)) throw new Error("Invalid update version");
  return `Moon-Browser-${version.replace(/^v/, "")}-Linux-x64.AppImage`;
}

export async function verifyAppImageSignature(file: string, signature: Uint8Array, publicKeyPem: string): Promise<boolean> {
  if (signature.length !== 64) return false;
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") return false;
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return verify(null, digest.digest(), key, signature);
}

export async function verifyDownloadedAppImage(
  files: readonly string[], version: string, releaseUrl: string, publicKeyPem: string,
  request: typeof fetch = fetch
): Promise<void> {
  const asset = appImageAssetName(version);
  if (files.length !== 1 || basename(files[0]!) !== asset) throw new Error("Unexpected AppImage update file");
  const signatureUrl = new URL(`${asset}.sig`, releaseUrl);
  if (!releaseUrl.startsWith("https://github.com/heitgh/Moon-browser/releases/download/") ||
      signatureUrl.origin !== "https://github.com" || signatureUrl.search || signatureUrl.hash) throw new Error("Invalid signature URL");
  const response = await request(signatureUrl.href, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body) throw new Error("Update signature unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64) throw new Error("Invalid update signature length");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const signature = Buffer.concat(chunks);
  if (!(await verifyAppImageSignature(files[0]!, signature, publicKeyPem))) throw new Error("Invalid AppImage update signature");
}
