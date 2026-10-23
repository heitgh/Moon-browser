import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiagnostics } from "../../apps/desktop/electron/services/local-diagnostics.js";
it("is off by default and rotates bounded local logs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "moon-logs-")); const file = join(dir, "diagnostics.jsonl");
  try {
    await new LocalDiagnostics(dir).record("test", {}); await expect(stat(file)).rejects.toThrow();
    const log = new LocalDiagnostics(dir, true);
    await Promise.all([log.record("crash", { reason: "crashed", version: "test" }), log.record("memory", { processes: 10 })]);
    expect((await readFile(file, "utf8")).trim().split("\n")).toHaveLength(2);
    await writeFile(file, "x".repeat(1_000_001)); await log.record("next", {});
    expect((await stat(`${file}.previous`)).size).toBe(1_000_001); expect((await stat(file)).size).toBeLessThan(1000);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
