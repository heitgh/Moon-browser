import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/electron/**/*.test.ts"],
    environment: "node",
    // Fsync/rename fixtures compete for disk on Windows hosted runners.
    // Keep in-test concurrency assertions; serialize independent test files.
    fileParallelism: false,
    passWithNoTests: false
  }
});
