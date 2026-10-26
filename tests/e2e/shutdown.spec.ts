// Nexus Inc. — repeated real-process shutdown against the same SQLite profile.
import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("reopens one profile after 30 bounded shutdown cycles", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(join(tmpdir(), "moon-shutdown-cycles-"));
  try {
    for (let cycle = 0; cycle < 30; cycle++) {
      const application = await electron.launch({
        args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
        env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
      });
      const child = application.process();
      let stderr = ""; child.stderr?.on("data", chunk => { stderr += String(chunk); });
      try {
        await expect.poll(() => application.windows().some(page => page.url().endsWith("/index.html"))).toBe(true);
        if (cycle % 2 === 1) await application.windows().find(page => page.url().endsWith("/index.html"))!.waitForLoadState("load");
        const exited = new Promise<number | null>(resolve => child.once("exit", code => resolve(code)));
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            application.close(),
            new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`Shutdown exceeded 5 seconds at cycle ${cycle}`)), 5000); })
          ]);
        } finally { clearTimeout(timer); }
        expect(await exited, `Cycle ${cycle}: ${stderr}`).toBe(0);
      } finally { if (child.exitCode === null) child.kill(); }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
