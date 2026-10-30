// Nexus Inc. — failure-injection tests for real SQLite profile recovery.
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProfileStorage } from "../../apps/desktop/electron/services/profile-storage.js";
import { ProfileRecoveryService } from "../../apps/desktop/electron/services/profile-recovery.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "moon-recovery-"));
  directories.push(root);
  const directory = join(root, "profile");
  const storage = new ProfileStorage(directory);
  await storage.open();
  return { root, directory, storage, recovery: new ProfileRecoveryService(directory) };
}

describe("ProfileRecoveryService", () => {
  it("backs up SQLite before an update and restores data after simulated corruption without erasing the original", async () => {
    const { directory, storage, recovery } = await fixture();
    await storage.applyProfileMutation({ type: "notes:save", content: "Dados importantes" });
    const snapshot = await storage.createUpdateBackup();
    expect((await stat(snapshot)).isFile()).toBe(true);
    await storage.close();
    await writeFile(join(directory, "moon.sqlite3"), "not a sqlite database");
    const backups = await recovery.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]?.source).toBe("update");
    const preserved = await recovery.restoreBackup(backups[0]!.id);
    expect(await readFile(join(preserved, "moon.sqlite3"), "utf8")).toBe("not a sqlite database");
    const reopened = new ProfileStorage(directory);
    await reopened.open();
    expect((await reopened.loadProfileData()).notes).toBe("Dados importantes");
    await reopened.close();
  });

  it("rejects invalid or damaged backups without changing the original profile", async () => {
    const { directory, storage, recovery } = await fixture();
    const backup = await storage.createUpdateBackup();
    await storage.close();
    await writeFile(backup, "bad backup");
    expect(await recovery.listBackups()).toEqual([]);
    await expect(recovery.restoreBackup("update/../../moon.sqlite3")).rejects.toThrow();
    await expect(recovery.restoreBackup("update/" + backup.split("/").at(-1))).rejects.toThrow();
    const reopened = new ProfileStorage(directory);
    await reopened.open(); await reopened.close();
  });

  it("refuses to replace a corrupt profile registry and keeps the original database", async () => {
    const { root, directory, storage, recovery } = await fixture();
    await storage.close();
    const profiles = join(root, "profiles");
    await mkdir(profiles);
    await writeFile(join(profiles, "index.json"), "not-json");
    await expect(recovery.createFresh(profiles)).rejects.toThrow(/registro de perfis/i);
    expect((await stat(join(directory, "moon.sqlite3"))).isFile()).toBe(true);
  });

  it("exports raw emergency files and creates a fresh profile while keeping the old directory", async () => {
    const { root, directory, storage, recovery } = await fixture();
    await storage.applyProfileMutation({ type: "notes:save", content: "Preservar" });
    await storage.close();
    const destinationRoot = join(root, "exports");
    await import("node:fs/promises").then(fs => fs.mkdir(destinationRoot));
    const exported = await recovery.exportEmergency(destinationRoot);
    expect((await stat(join(exported, "moon.sqlite3"))).isFile()).toBe(true);
    await expect(recovery.exportEmergency(directory)).rejects.toThrow();
    const registryDirectory = join(root, "profiles");
    const newId = await recovery.createFresh(registryDirectory);
    expect(newId).not.toBe("default");
    expect((await stat(join(directory, "moon.sqlite3"))).isFile()).toBe(true);
    const original = new ProfileStorage(directory);
    await original.open();
    expect((await original.loadProfileData()).notes).toBe("Preservar");
    await original.close();
    const fresh = new ProfileStorage(join(registryDirectory, newId));
    await fresh.open();
    expect((await fresh.loadProfileData()).notes).toBe("");
    await fresh.close();
    const registry = JSON.parse(await readFile(join(registryDirectory, "index.json"), "utf8")) as { profiles: { id: string; default: boolean }[] };
    expect(registry.profiles.find(profile => profile.id === "default")?.default).toBe(false);
    expect(registry.profiles.find(profile => profile.id === newId)?.default).toBe(true);
    expect(await readdir(root)).toContain("profile");
  });
});
