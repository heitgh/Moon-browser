// Nexus Inc. — explicitly enabled local diagnostics; never records page URLs/content.
import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { platform, release } from "node:os";
import type { App } from "electron";

export class LocalDiagnostics {
  #queue = Promise.resolve();
  constructor(readonly directory: string, readonly enabled = false) {}
  record(kind: string, fields: Readonly<Record<string, string | number>>): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    this.#queue = this.#queue.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const path = join(this.directory, "diagnostics.jsonl");
      if ((await stat(path).catch(() => undefined))?.size! > 1_000_000) await rename(path, `${path}.previous`);
      await appendFile(path, `${JSON.stringify({ time: new Date().toISOString(), kind, ...fields })}\n`, { mode: 0o600 });
    }).catch(() => { /* Diagnostics must never interrupt browsing. */ });
    return this.#queue;
  }
}
export function installLocalDiagnostics(app: App): void {
  if (process.env.MOON_LOCAL_DIAGNOSTICS !== "1") return;
  const log = new LocalDiagnostics(join(app.getPath("userData"), "diagnostics"), true);
  const context = { version: app.getVersion(), platform: platform(), os: release() };
  void log.record("started", context);
  app.on("web-contents-created", (_event, contents) => {
    contents.on("render-process-gone", (_event, details) => { void log.record("renderer-exit", { ...context, reason: details.reason, exitCode: details.exitCode }); });
    contents.on("unresponsive", () => { void log.record("unresponsive", context); });
  });
  app.on("child-process-gone", (_event, details) => { void log.record("child-exit", { ...context, type: details.type, reason: details.reason, exitCode: details.exitCode }); });
  const timer = setInterval(() => {
    const metrics = app.getAppMetrics();
    void log.record("memory", { ...context, processes: metrics.length, workingSetKiB: metrics.reduce((sum, entry) => sum + entry.memory.workingSetSize, 0) });
  }, 30_000);
  timer.unref(); app.once("will-quit", () => clearInterval(timer));
}
