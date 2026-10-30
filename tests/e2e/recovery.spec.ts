// Nexus Inc. — corrupted profile must open an isolated recovery UI.
import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("shows profile recovery rather than exiting when SQLite cannot open", async () => {
  const directory = await mkdtemp(join(tmpdir(), "moon-recovery-e2e-"));
  try {
    const profile = join(directory, "profile");
    await mkdir(profile);
    await writeFile(join(profile, "moon.sqlite3"), "corrupted database");
    const application = await electron.launch({
      args: [...(process.env.MOON_HEADLESS === "1" ? ["--ozone-platform=headless"] : []), `--user-data-dir=${directory}`, "."],
      env: { ...process.env, NODE_ENV: "test", MOON_TEST_OFFLINE: "1", MOON_TEST_PROFILE_DIR: directory }
    });
    try {
      const recovery = application.windows()[0] ?? await application.firstWindow();
      await expect(recovery.locator("h1")).toHaveText("Recuperação de perfil");
      await expect(recovery.locator("#restore")).toBeDisabled();
      await expect(recovery.locator("#export")).toBeEnabled();
      await expect(recovery.locator("#fresh")).toBeEnabled();
      await expect(recovery.locator("#status")).toContainText("Nenhum backup íntegro");
    } finally { await application.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
