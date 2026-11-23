/* global process, console */
import { getCurrentFuseWire, FuseV1Options, FuseVersion } from "@electron/fuses";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), "release");
let binary;
if (process.platform === "darwin") {
  const roots = (await readdir(output)).filter(name => name.startsWith("mac"));
  const apps = [];
  for (const root of roots) {
    for (const name of await readdir(join(output, root))) {
      if (name.endsWith(".app") && name.includes("Moon")) apps.push(join(output, root, name));
    }
  }
  if (apps.length !== 1) throw new Error(`Expected one unpacked Moon app, found ${apps.length}`);
  binary = apps[0];
} else {
  const directory = join(output, process.platform === "win32" ? "win-unpacked" : "linux-unpacked");
  const expected = process.platform === "win32" ? /^Moon Browser\.exe$/i : /^moon-browser$/i;
  const names = (await readdir(directory)).filter(name => expected.test(name));
  if (names.length !== 1) throw new Error(`Expected one unpacked Moon executable, found ${names.length}`);
  binary = join(directory, names[0]);
}

const current = await getCurrentFuseWire(binary);
if (current.version !== FuseVersion.V1) throw new Error(`Unsupported fuse version: ${current.version}`);
// @electron/fuses represents disabled/enabled as ASCII 0/1 in the binary wire.
const expected = new Map([
  [FuseV1Options.RunAsNode, 0x30],
  [FuseV1Options.EnableNodeCliInspectArguments, 0x30],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, 0x30],
  [FuseV1Options.OnlyLoadAppFromAsar, 0x31],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, 0x31]
]);
for (const [fuse, state] of expected) {
  if (current[fuse] !== state) throw new Error(`${FuseV1Options[fuse]} has unexpected state ${current[fuse]}`);
}
console.log(`Verified five Electron fuses in ${binary}`);
