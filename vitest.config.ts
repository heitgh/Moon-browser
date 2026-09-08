import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup-dom.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "release/**", "src/**", "sunshine/**", "tests/electron/**"],
    environment: "node",
    passWithNoTests: false
  }
});
