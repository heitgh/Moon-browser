// Nexus Inc. — portable environment assignment for Windows and Linux.
const process = require("node:process");
const console = require("node:console");
const { spawnSync } = require("node:child_process");
const result = spawnSync(require("electron"), ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.electron.config.ts"], {
  stdio: "inherit", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
