import type { StoragePlatform, StorageQuery } from "@moon/platform";
import type { IpcRouter } from "./ipc-router.js";
export function registerStorageIpc(router: IpcRouter, storage: StoragePlatform): void { router.register("storage:get", (_event, query: StorageQuery) => storage.get(query)); router.register("storage:set", async (_event, payload: { query: StorageQuery; value: unknown }) => { await storage.set(payload.query, payload.value); return null; }); }
