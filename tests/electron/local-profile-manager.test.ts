import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalProfileManager } from "../../apps/desktop/electron/services/local-profile-manager.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function manager(): Promise<{ root: string; legacy: string; profiles: LocalProfileManager }> {
  const root = await mkdtemp(join(tmpdir(), "moon-profiles-")); directories.push(root);
  const legacy = join(root, "profile");
  const profiles = new LocalProfileManager(join(root, "profiles"), legacy);
  return { root, legacy, profiles };
}

describe("LocalProfileManager", () => {
  it("adopts and preserves the current directory only after SQLite opens", async () => {
    const { legacy, profiles } = await manager();
    const primary = await profiles.initialize();
    expect(primary).toMatchObject({ id: "default", default: true, kind: "persistent" });
    expect((await stat(join(legacy, "moon.sqlite3"))).isFile()).toBe(true);
    const registry = JSON.parse(await readFile(join(profiles.profilesDirectory, "index.json"), "utf8")) as { migratedLegacyDefault: boolean };
    expect(registry.migratedLegacyDefault).toBe(true);
    await profiles.close();
    const reopened = new LocalProfileManager(profiles.profilesDirectory, legacy);
    expect((await reopened.initialize()).id).toBe("default");
    await reopened.close();
  });

  it("uses separate SQLite directories and enforces strong deletion confirmation", async () => {
    const { profiles } = await manager(); await profiles.initialize();
    const second = await profiles.create({ name: "Produto", avatar: "briefcase", color: "#2563eb" });
    expect((await profiles.storage(second.id)).profileDirectory).not.toBe((await profiles.storage("default")).profileDirectory);
    expect(() => profiles.deletionSummary("default")).toThrow(/padrão/i);
    await expect(profiles.delete({ id: second.id, confirmation: "errado", backup: false })).rejects.toThrow(/exatamente/i);
    await expect(profiles.delete({ id: second.id, confirmation: "Produto", backup: true })).resolves.toMatchObject({ id: second.id, backupPath: expect.any(String) });
    expect(profiles.list().map(profile => profile.id)).toEqual(["default"]);
    await profiles.close();
  });

  it("keeps guests out of the registry and removes their temporary storage", async () => {
    const { profiles } = await manager(); await profiles.initialize();
    const guest = await profiles.createGuest(); const directory = (await profiles.storage(guest.id)).profileDirectory;
    expect(guest.kind).toBe("guest");
    await profiles.releaseGuest(guest.id);
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
    const registry = await readFile(join(profiles.profilesDirectory, "index.json"), "utf8");
    expect(registry).not.toContain(guest.id);
    await profiles.close();
  });
});
