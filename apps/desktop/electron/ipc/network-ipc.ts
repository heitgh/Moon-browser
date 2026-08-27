import type { NetworkPlatform } from "@moon/platform";
import type { IpcRouter } from "./ipc-router.js";
export function registerNetworkIpc(router: IpcRouter, network: NetworkPlatform): void { router.register("network:clear-cache", async () => { await network.clearNetworkCache(); return null; }); }
