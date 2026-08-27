import { app, type Session } from "electron";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import fetch from "cross-fetch";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { WindowManager } from "../main/window-manager.js";

export type AdblockPhase = "loading" | "active" | "disabled" | "failed";
export interface AdblockStatus {
  readonly phase: AdblockPhase;
  readonly enabled: boolean;
  readonly blockedCount: number;
  readonly error?: string;
}

export class ElectronAdblockService {
  readonly #sessions = new Set<Session>();
  #blocker: ElectronBlocker | undefined;
  #enabled = true;
  #blockedCount = 0;
  #phase: AdblockPhase = "loading";
  #error: string | undefined;

  constructor(readonly windows: WindowManager) {}

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
      for (const session of this.#sessions) this.#apply(session);
    } catch (error) {
      this.#phase = "failed";
      this.#error = error instanceof Error ? error.message : String(error);
      console.error("Moon AdBlock failed to initialize", error);
    }
    this.#broadcast();
  }

  attach(session: Session): void {
    if (this.#sessions.has(session)) return;
    this.#sessions.add(session);
    this.#apply(session);
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#blocker) {
      for (const session of this.#sessions) this.#apply(session);
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

  #apply(session: Session): void {
    const blocker = this.#blocker;
    if (!blocker) return;
    if (!this.#enabled) {
      session.webRequest.onHeadersReceived(null);
      session.webRequest.onBeforeRequest(null);
      return;
    }
    session.webRequest.onHeadersReceived(
      { urls: ["<all_urls>"] },
      (details, callback) => blocker.onHeadersReceived(details, callback)
    );
    session.webRequest.onBeforeRequest(
      { urls: ["<all_urls>"] },
      (details, callback) => blocker.onBeforeRequest(details, callback)
    );
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
