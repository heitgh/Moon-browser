import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalProfileManager, ProfileOpenError } from "../../apps/desktop/electron/services/local-profile-manager.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function manager(): Promise<{ root: string; legacy: string; profiles: LocalProfileManager }> {
  const root = await mkdtemp(join(tmpdir(), "moon-profiles-")); directories.push(root);
  const legacy = join(root, "profile");
  const profiles = new LocalProfileManager(join(root, "profiles"), legacy);
  return { root, legacy, profiles };
}

describe("LocalProfileManager", () => {
  it("identifies the actual secondary profile that failed to open", async () => {
    const { profiles, legacy } = await manager();
    await profiles.initialize();
    const second = await profiles.create({ name: "Danificado", avatar: "moon", color: "#2563eb" });
    await profiles.close();
    const path = join(profiles.profilesDirectory, second.id);
    await writeFile(join(path, "moon.sqlite3"), "damaged secondary");
    const next = new LocalProfileManager(profiles.profilesDirectory, legacy);
    await next.initialize();
    try {
      await expect(next.storage(second.id)).rejects.toBeInstanceOf(ProfileOpenError);
      await expect(next.storage(second.id)).rejects.toMatchObject({directory: path});
      expect((await next.storage("default")).profileDirectory).toBe(legacy);
    } finally { await next.close(); }
  });
  it("shares one connection when two windows open the same profile concurrently", async () => {
    const { profiles, legacy } = await manager();
    await profiles.initialize();
    await profiles.close();
    const reopened = new LocalProfileManager(profiles.profilesDirectory, legacy);
    // initialize also opens the default; a secondary profile exercises the lazy path.
    await reopened.initialize();
    const secondary = await reopened.create({ name: "Concorrente", avatar: "moon", color: "#2563eb" });
    await reopened.close();
    const next = new LocalProfileManager(profiles.profilesDirectory, legacy);
    await next.initialize();
    const [a, b] = await Promise.all([next.storage(secondary.id), next.storage(secondary.id)]);
    expect(a).toBe(b);
    await next.close();
  });
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

it("lets internal persistence finish only on already opened stores while new access is blocked", async () => {
  const {root, legacy} = await manager();
  let locked = false;
  const profiles = new LocalProfileManager(join(root, "profiles"), legacy, async () => { if (locked) throw new Error("locked"); });
  await profiles.initialize();
  const second = await profiles.create({name: "Protected", avatar: "moon", color: "#2563eb"});
  const storage = await profiles.storage("default");
  locked = true;
  await expect(profiles.storage("default")).rejects.toThrow("locked");
  await expect(profiles.delete({id: second.id, confirmation: "Protected", backup: false})).rejects.toThrow("locked");
  expect(profiles.openedStorage("default")).toBe(storage);
  await profiles.openedStorage("default").saveBrowserSession([]);
  expect(() => profiles.openedStorage("unknown")).toThrow();
  await profiles.close();
  expect(() => profiles.openedStorage("default")).toThrow(/aberto/);
});
