import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MoonThemeService } from "../../apps/desktop/electron/services/moon-theme-service.js";
import { ProfileStorage } from "../../apps/desktop/electron/services/profile-storage.js";
import { moonThemeFixture } from "../fixtures/moon-themes/fixture-factory.js";

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

async function profile(): Promise<ProfileStorage> { const directory = await mkdtemp(join(tmpdir(), "moon-theme-service-")); directories.push(directory); const storage = new ProfileStorage(directory); await storage.open(); return storage; }

describe("MoonThemeService", () => {
  it("cancels quarantine and persists install, apply, rollback and safe removal", async () => {
    const storage = await profile(); const service = new MoonThemeService(storage, "0.1.0");
    const cancelled = await service.stage(moonThemeFixture()); await service.cancel(cancelled.intentId); expect(await service.list()).toEqual([]);

    const first = await service.confirm((await service.stage(moonThemeFixture({ version: "1.0.0" }))).intentId);
    expect(first.active).toBe(false); expect((await service.apply(first.id)).tokens.colors?.accent).toBe("#7c5cff"); await service.activate(first.id);

    const second = await service.confirm((await service.stage(moonThemeFixture({ version: "2.0.0", theme: { colors: { accent: "#22aa88" } } }))).intentId);
    await service.activate(second.id); const rollback = await service.rollback(first.packageId); expect(rollback.summary.version).toBe("1.0.0"); await service.activate(rollback.summary.id);
    await service.remove(second.id); await expect(service.remove(first.id)).rejects.toThrow(/tema ativo/i);
    await storage.close();

    const reopened = new ProfileStorage(storage.profileDirectory); await reopened.open(); const persisted = await new MoonThemeService(reopened, "0.1.0").list(); expect(persisted).toHaveLength(1); expect(persisted[0]?.active).toBe(true); await reopened.close();
  });
});
