import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

await rm("dist/types", { recursive: true, force: true });
await run(process.execPath, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.build.json"]);

const electron = spawn(
  process.execPath,
  ["node_modules/electron/cli.js", "."],
  { stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } }
);

const shutdown = (signal: NodeJS.Signals): void => { electron.kill(signal); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
electron.once("exit", code => { process.exitCode = code ?? 1; });
