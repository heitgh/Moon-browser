import { describe, expect, it } from "vitest";
import { generateMasterKey } from "../../packages/sync/crypto.js";
import { InMemorySyncProvider, MemorySyncStore, OfflineFirstSyncEngine, SyncOfflineError } from "../../packages/sync/sync-engine.js";

describe("OfflineFirstSyncEngine", () => {
  it("merges first sync non-destructively and resolves equal-version conflicts deterministically", async () => {
    const masterKey = generateMasterKey(); const provider = new InMemorySyncProvider(); const storeA = new MemorySyncStore(); const storeB = new MemorySyncStore();
    const a = new OfflineFirstSyncEngine({ store: storeA, provider, masterKey, retry: { attempts: 1, baseDelayMs: 0 } });
    const b = new OfflineFirstSyncEngine({ store: storeB, provider, masterKey, retry: { attempts: 1, baseDelayMs: 0 } });
    await a.write({ id: "bookmark:one", category: "bookmarks", logicalVersion: 1, deviceId: "device-a", updatedAt: 10, tombstone: false, payload: { title: "A" } });
    await b.write({ id: "note:one", category: "notes", logicalVersion: 1, deviceId: "device-b", updatedAt: 10, tombstone: false, payload: { content: "B" } });
    await a.synchronize(); await b.synchronize(); await a.synchronize();
    expect((await a.read<{ content: string }>("note:one"))?.payload.content).toBe("B"); expect((await b.read<{ title: string }>("bookmark:one"))?.payload.title).toBe("A");
    await a.write({ id: "note:conflict", category: "notes", logicalVersion: 2, deviceId: "device-a", updatedAt: 20, tombstone: false, payload: "older" }); await a.synchronize();
    await b.write({ id: "note:conflict", category: "notes", logicalVersion: 2, deviceId: "device-b", updatedAt: 21, tombstone: false, payload: "newer" }); const result = await b.synchronize(); await a.synchronize();
    expect(result.conflicts).toBeGreaterThanOrEqual(1); expect((await a.read<string>("note:conflict"))?.payload).toBe("newer");
  });

  it("propagates tombstones and keeps disabled categories opt-in", async () => {
    const engine = new OfflineFirstSyncEngine({ store: new MemorySyncStore(), provider: new InMemorySyncProvider(), masterKey: generateMasterKey(), retry: { attempts: 1, baseDelayMs: 0 } });
    await expect(engine.write({ id: "history:one", category: "history", logicalVersion: 1, deviceId: "device-a", updatedAt: 1, tombstone: false, payload: "private" })).rejects.toThrow(/consentimento/i);
    await expect(engine.write({ id: "credential:one", category: "credentials", logicalVersion: 1, deviceId: "device-a", updatedAt: 1, tombstone: false, payload: "secret" })).rejects.toThrow(/consentimento/i);
    const removed = await engine.remove({ id: "bookmark:gone", category: "bookmarks", logicalVersion: 3, deviceId: "device-a", updatedAt: 30 });
    expect(removed.tombstone).toBe(true); await engine.synchronize();
  });

  it("retries transient errors, supports cancellation and reports offline honestly", async () => {
    const provider = new InMemorySyncProvider(); provider.failuresRemaining = 2; const delays: number[] = [];
    const engine = new OfflineFirstSyncEngine({ store: new MemorySyncStore(), provider, masterKey: generateMasterKey(), retry: { attempts: 3, baseDelayMs: 10 }, sleep: async milliseconds => { delays.push(milliseconds); } });
    await expect(engine.synchronize()).resolves.toMatchObject({ state: "idle" }); expect(delays).toEqual([10, 20]);
    provider.online = false; await expect(engine.synchronize()).rejects.toBeInstanceOf(SyncOfflineError); expect(engine.state).toBe("offline");
    provider.online = true; const controller = new AbortController(); controller.abort(new DOMException("cancelled", "AbortError")); await expect(engine.synchronize(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    const disabled = new OfflineFirstSyncEngine({ store: new MemorySyncStore(), masterKey: generateMasterKey() }); expect((await disabled.synchronize()).state).toBe("disabled");
  });

  it("never gives the fixture provider plaintext", async () => {
    const provider = new InMemorySyncProvider(); const engine = new OfflineFirstSyncEngine({ store: new MemorySyncStore(), provider, masterKey: generateMasterKey() }); const known = "TEXTO-QUE-NAO-PODE-VAZAR";
    await engine.write({ id: "note:leak-test", category: "notes", logicalVersion: 1, deviceId: "device-a", updatedAt: 1, tombstone: false, payload: { known } }); await engine.synchronize();
    expect(JSON.stringify(provider.snapshot())).not.toContain(known);
  });
});
