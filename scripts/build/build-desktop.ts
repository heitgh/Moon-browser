import { spawn } from "node:child_process";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", code => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}`)));
  });
}

const requested = process.argv.slice(2);
if (requested.length && (requested[0] !== "--linux" || requested.length < 2 || !requested.slice(1).every(target => ["AppImage", "deb", "rpm", "pacman"].includes(target)))) throw new Error("Alvos aceitos: --linux AppImage deb rpm pacman");
const signedRelease = process.env.MOON_RELEASE_SIGNED === "1";
if (signedRelease && process.platform === "win32") {
  for (const name of ["CSC_LINK", "CSC_KEY_PASSWORD", "MOON_WINDOWS_PUBLISHER_NAME"] as const) {
    if (!process.env[name]?.trim()) throw new Error(`Signed Windows release requires ${name}`);
  }
}
if (signedRelease && process.platform === "linux" && !process.env.LINUX_UPDATE_SIGNING_KEY_B64?.trim()) {
  throw new Error("Signed Linux release requires LINUX_UPDATE_SIGNING_KEY_B64");
}
await rm("dist/types", { recursive: true, force: true });
await run(process.execPath, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.build.json"]);
if (signedRelease && process.platform === "linux") {
  const encoded = process.env.LINUX_UPDATE_SIGNING_KEY_B64!;
  const privateKey = createPrivateKey(Buffer.from(encoded, "base64").toString("utf8"));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("Linux update key must be Ed25519");
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  await mkdir("dist/types/security", { recursive: true });
  await writeFile("dist/types/security/moon-update-public.pem", publicKey, { mode: 0o644 });
}
if (signedRelease && process.platform === "win32") {
  await mkdir("dist/types/security", { recursive: true });
  await writeFile("dist/types/security/moon-signed-windows-release", "signed-release\n", { mode: 0o644 });
}
await run(process.execPath, ["node_modules/electron-builder/out/cli/cli.js", "--config", signedRelease && process.platform === "win32" ? "electron-builder.release.cjs" : "electron-builder.channel.cjs", "--publish", "never", ...requested]);
