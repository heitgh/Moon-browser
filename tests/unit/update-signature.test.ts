import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { appImageAssetName, verifyAppImageSignature, verifyDownloadedAppImage } from "../../apps/desktop/electron/services/update-signature.js";

it("verifies a signed AppImage and rejects tampering and forged signatures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-update-signature-"));
  const asset = appImageAssetName("v0.6.0-alpha.8");
  const file = join(directory, asset);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  try {
    const data = Buffer.from("local AppImage fixture");
    await writeFile(file, data);
    const signature = sign(null, createHash("sha256").update(data).digest(), privateKey);
    expect(await verifyAppImageSignature(file, signature, pem)).toBe(true);
    const request = vi.fn(async () => new Response(signature));
    await verifyDownloadedAppImage([file], "v0.6.0-alpha.8", "https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.8/", pem, request as typeof fetch);
    expect(request).toHaveBeenCalledWith(`https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.8/${asset}.sig`, expect.any(Object));
    await writeFile(file, "tampered");
    await expect(verifyDownloadedAppImage([file], "v0.6.0-alpha.8", "https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.8/", pem, request as typeof fetch)).rejects.toThrow("Invalid AppImage");
    await expect(verifyDownloadedAppImage([join(directory, "other.AppImage")], "v0.6.0-alpha.8", "https://github.com/heitgh/Moon-browser/releases/download/v0.6.0-alpha.8/", pem, request as typeof fetch)).rejects.toThrow("Unexpected");
    expect(await verifyAppImageSignature(file, Buffer.alloc(64), pem)).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
