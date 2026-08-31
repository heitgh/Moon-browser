import { app } from "electron";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import fetch from "cross-fetch";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { WindowManager } from "../main/window-manager.js";
import type { SessionRequestPipeline } from "../security/session-request-pipeline.js";

export type AdblockPhase = "loading" | "active" | "disabled" | "failed";
export interface AdblockStatus {
  readonly phase: AdblockPhase;
  readonly enabled: boolean;
  readonly blockedCount: number;
  readonly error?: string;
}

export class ElectronAdblockService {
  #blocker: ElectronBlocker | undefined;
  #enabled = true;
  #blockedCount = 0;
  #phase: AdblockPhase = "loading";
  #error: string | undefined;

  constructor(readonly windows: WindowManager, pipeline: SessionRequestPipeline) {
    pipeline.register({
      id: "adblock",
      beforeRequest: details => this.#beforeRequest(details),
      headersReceived: details => this.#headersReceived(details)
    });
  }

  async initialize(): Promise<void> {
    try {
      const cachePath = join(app.getPath("userData"), "adblock-engine.bin");
      this.#blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
        path: cachePath,
        read: readFile,
        write: writeFile
      });
      this.#blocker.on("request-blocked", () => {
        this.#blockedCount += 1;
        this.#broadcast();
      });
      this.#phase = this.#enabled ? "active" : "disabled";
    } catch (error) {
      this.#phase = "failed";
      this.#error = error instanceof Error ? error.message : String(error);
      console.error("Moon AdBlock failed to initialize", error);
    }
    this.#broadcast();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#blocker) {
      this.#phase = enabled ? "active" : "disabled";
    }
    this.#broadcast();
  }

  status(): AdblockStatus {
    return {
      phase: this.#phase,
      enabled: this.#enabled,
      blockedCount: this.#blockedCount,
      ...(this.#error ? { error: this.#error } : {})
    };
  }

  #beforeRequest(details: Electron.OnBeforeRequestListenerDetails): Promise<Electron.CallbackResponse> | undefined {
    const blocker = this.#blocker; if (!this.#enabled || !blocker) return undefined;
    return new Promise(resolve => blocker.onBeforeRequest(details, resolve));
  }

  #headersReceived(details: Electron.OnHeadersReceivedListenerDetails): Promise<Electron.HeadersReceivedResponse> | undefined {
    const blocker = this.#blocker; if (!this.#enabled || !blocker) return undefined;
    return new Promise(resolve => blocker.onHeadersReceived(details, resolve));
  }

  #broadcast(): void {
    const status = this.status();
    for (const window of this.windows.list()) {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send("adblock:status", status);
      }
    }
  }
}
