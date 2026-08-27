import type { ExtensionPlatform, NetworkPlatform, StoragePlatform } from "@moon/platform";
import type { ElectronBrowserManager } from "../browser/browser-manager.js";
import type { WindowManager } from "../main/window-manager.js";
import { registerBrowserIpc } from "./browser-ipc.js"; import { registerExtensionIpc } from "./extension-ipc.js"; import { IpcRouter } from "./ipc-router.js"; import { registerNetworkIpc } from "./network-ipc.js"; import { registerStorageIpc } from "./storage-ipc.js"; import { registerSystemIpc } from "./system-ipc.js";
export interface IpcDependencies { readonly browser: ElectronBrowserManager; readonly windows: WindowManager; readonly storage: StoragePlatform; readonly network: NetworkPlatform; readonly extensions: ExtensionPlatform; }
export function registerIpcHandlers(dependencies: IpcDependencies): IpcRouter { const router = new IpcRouter(); registerBrowserIpc(router, dependencies.browser, dependencies.windows); registerStorageIpc(router, dependencies.storage); registerNetworkIpc(router, dependencies.network); registerExtensionIpc(router, dependencies.extensions); registerSystemIpc(router); return router; }
