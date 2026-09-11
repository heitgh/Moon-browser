import { existsSync } from "node:fs";
import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
const detectedWayland = process.env.MOON_HEADLESS === "1" ? undefined : process.env.WAYLAND_DISPLAY ?? (existsSync(join(runtimeDirectory, "wayland-1")) ? "wayland-1" : undefined);
const desktopEnv = { ...process.env, ...(detectedWayland ? { WAYLAND_DISPLAY: detectedWayland, XDG_RUNTIME_DIR: runtimeDirectory } : {}) };
const platformArguments = detectedWayland ? ["--ozone-platform=wayland"] : [];
const profile = await mkdtemp(join(tmpdir(), "moon-resource-sample-"));
const server = createServer((_request, response) => { response.setHeader("content-type", "text/html"); response.end("<!doctype html><title>Resource fixture</title><p>Local deterministic page for resource sampling.</p>"); });
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const source = process.env.MOON_MEASURE_SOURCE ?? process.cwd();
const start = performance.now();
const application = await electron.launch({ cwd: source, args: [...platformArguments, `--user-data-dir=${profile}`, "."], env: { ...desktopEnv, NODE_ENV: "test", MOON_TEST_PROFILE_DIR: profile } });
try {
  await expect.poll(() => application.windows().some(p => /index.html$/.test(p.url()))).toBe(true);
  const page = application.windows().find(p => /index.html$/.test(p.url()))!;
  await page.getByLabel("Pular configuração inicial").click();
  const bootMs = Math.round(performance.now() - start);
  const samples = [];
  for (const count of [1, 10, 50]) {
    await page.evaluate(async ({ count, url }) => {
      const bridge = (window as unknown as { moonBrowser: MoonBrowserBridge }).moonBrowser;
      const existing = await bridge.getTabs();
      if (existing[0]) await bridge.navigate(existing[0].id, `${url}/1`);
      for (let n = existing.length; n < count; n += 1) await bridge.createTab(`${url}/${n + 1}`, "research");
    }, { count, url });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await application.evaluate(({ app }) => app.getAppMetrics());
    await new Promise(resolve => setTimeout(resolve, 1000));
    const sample = await application.evaluate(({ app }) => {
      const metrics = app.getAppMetrics();
      return { processes: metrics.length, workingSetMiB: Math.round(metrics.reduce((total, m) => total + m.memory.workingSetSize, 0) / 1024), cpuPercentSum: Math.round(metrics.reduce((total, m) => total + m.cpu.percentCPUUsage, 0) * 10) / 10 };
    }); samples.push({ tabs: count, ...sample });
  }
  console.log(JSON.stringify({ version: await application.evaluate(({ app }) => app.getVersion()), bootIncludingOnboardingMs: bootMs, sampleCount: 1, fixture: "local simple HTML; no media or real-world workload", samples }, null, 2));
} finally { await application.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(profile, { recursive: true, force: true }); }
