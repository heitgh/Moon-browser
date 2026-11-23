/* global process, Buffer */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest();
}

const [action, file, publicKeyPath, signaturePath] = process.argv.slice(2);
if (!file || !publicKeyPath || !signaturePath || !["sign", "verify"].includes(action)) {
  throw new Error("Usage: appimage-signature.mjs sign|verify AppImage public.pem AppImage.sig");
}
if (action === "sign") {
  const encoded = process.env.LINUX_UPDATE_SIGNING_KEY_B64;
  if (!encoded) throw new Error("Missing LINUX_UPDATE_SIGNING_KEY_B64");
  const privateKey = createPrivateKey(Buffer.from(encoded, "base64").toString("utf8"));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Linux update key must be Ed25519");
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  await writeFile(publicKeyPath, publicKey);
  await writeFile(signaturePath, sign(null, await digest(file), privateKey));
} else {
  const publicKey = createPublicKey(await readFile(publicKeyPath));
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("Linux update key must be Ed25519");
  const signature = await readFile(signaturePath);
  if (signature.length !== 64 || !verify(null, await digest(file), publicKey, signature)) {
    throw new Error("Invalid AppImage update signature");
  }
}
