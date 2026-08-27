import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", code => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}`)));
  });
}

await rm("dist/types", { recursive: true, force: true });
await run(process.execPath, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.build.json"]);
await run(process.execPath, ["node_modules/electron-builder/out/cli/cli.js", "--config", "electron-builder.yml", "--publish", "never"]);
