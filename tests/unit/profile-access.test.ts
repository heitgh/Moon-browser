import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { ProfileAccessService } from "../../apps/desktop/electron/services/profile-access.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, {recursive: true, force: true}))); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "moon-access-")); directories.push(directory);
  let now = 10_000;
  const service = new ProfileAccessService(directory, "linux", () => now);
  await service.load("default");
  return {directory, service, advance: () => { now += 31_000; }};
}

it("persists only salted derived credentials and gates a fresh process before loading profile data", async () => {
  const {directory, service} = await fixture();
  service.assertUnlocked("default");
  await service.enable("default", "my-long-password");
  const raw = await readFile(join(directory, "default.json"), "utf8");
  expect(raw).not.toContain("my-long-password");
  expect(JSON.parse(raw)).toMatchObject({version: 1, salt: expect.stringMatching(/^[a-f0-9]{32}$/), key: expect.stringMatching(/^[a-f0-9]{128}$/)});
  const restarted = new ProfileAccessService(directory);
  await restarted.load("default");
  expect(() => restarted.assertUnlocked("default")).toThrow(/bloqueado/);
  expect(await restarted.unlock("default", "my-long-password")).toBe(true);
  restarted.assertUnlocked("default");
}, 15_000);

it("rejects wrong passwords, persists bounded retry delay and requires the current password to disable", async () => {
  const {directory, service, advance} = await fixture();
  await service.enable("default", "correct-password");
  expect(service.beginLock("default")).toBe(true);
  expect(() => service.assertUnlocked("default")).toThrow();
  service.assertLoadAllowed("default");
  await expect(service.unlock("default", "correct-password")).rejects.toThrow(/gravacao|gravação/);
  service.finishLock("default");
  expect(await service.unlock("default", "incorrect-password")).toBe(false);
  await expect(service.unlock("default", "correct-password")).rejects.toThrow(/Aguarde/);
  const restarted = new ProfileAccessService(directory, "linux", () => 10_000);
  await restarted.load("default");
  expect(restarted.status("default").retryAfterMs).toBeGreaterThan(0);
  advance();
  expect(await service.unlock("default", "correct-password")).toBe(true);
  await expect(service.disable("default", "incorrect-password")).rejects.toThrow(/incorreta/);
  expect(service.status("default").enabled).toBe(true);
  advance(); await service.disable("default", "correct-password");
  expect(service.status("default").enabled).toBe(false);
}, 15_000);

it("changes the password, validates automatic locking and refuses unsupported OS hooks", async () => {
  const {service, advance} = await fixture();
  await service.enable("default", "initial-password");
  await service.change("default", "initial-password", "replacement-password");
  await expect(service.configure("default", "replacement-password", 5, true)).rejects.toThrow(/plataforma/);
  await service.configure("default", "replacement-password", 5, false);
  expect(service.status("default").idleMinutes).toBe(5);
  service.beginLock("default"); service.finishLock("default");
  expect(await service.unlock("default", "initial-password")).toBe(false);
  advance(); expect(await service.unlock("default", "replacement-password")).toBe(true);
}, 15_000);

it("fails closed for corrupt protection records and invalid profile IDs", async () => {
  const {directory, service} = await fixture();
  await expect(service.load("../../other")).rejects.toThrow();
  await writeFile(join(directory, "damaged.json"), JSON.stringify({version: 1, salt: "invalid", key: "invalid"}));
  await expect(service.load("damaged")).rejects.toThrow(/inválida/);
  expect(() => service.assertUnlocked("damaged")).toThrow();
});

it("refuses oversized records and keeps access locked when a lock listener fails", async () => {
  const {directory, service} = await fixture();
  await writeFile(join(directory, "oversized.json"), "x".repeat(4097));
  await expect(service.load("oversized")).rejects.toThrow(/grande/);
  await service.enable("default", "secure-password");
  service.onLock(() => { throw new Error("consumer failure"); });
  expect(service.beginLock("default")).toBe(true);
  expect(() => service.assertUnlocked("default")).toThrow(/bloqueado/);
}, 15_000);

it("does not race locking against an in-flight password removal", async () => {
  const {service} = await fixture();
  await service.enable("default", "secure-password");
  const removing = service.disable("default", "secure-password");
  expect(service.beginLock("default")).toBe(false);
  await removing;
  expect(service.status("default")).toMatchObject({enabled: false, locked: false});
}, 15_000);
