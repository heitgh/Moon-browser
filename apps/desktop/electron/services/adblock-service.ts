import type { PrivacyService } from "./privacy-service.js";
import type { Session } from "electron";
import { app } from "electron";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import fetch from "cross-fetch";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { WindowManager } from "../main/window-manager.js";
import type { SessionRequestPipeline } from "../security/session-request-pipeline.js";
import { shouldBypassContentBlocking } from "../browser/compatibility-policy.js";

export type AdblockPhase = "loading" | "active" | "disabled" | "failed";
export interface AdblockStatus {
  readonly phase: AdblockPhase;
  readonly enabled: boolean;
  readonly blockedCount: number;
  readonly error?: string;
}

export class ElectronAdblockService {
  #blocker: ElectronBlocker | undefined;
  readonly #blockedCounts = new Map<string, number>();
  #phase: AdblockPhase = "loading";
  #error: string | undefined;

  constructor(readonly windows: WindowManager, pipeline: SessionRequestPipeline, readonly privacy: PrivacyService) {
    pipeline.register({
      id: "adblock",
      beforeRequest: (details, session) => this.#beforeRequest(details, session),
      headersReceived: (details, session) => this.#headersReceived(details, session)
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
      this.#phase = "active";
    } catch (error) {
      this.#phase = "failed";
      this.#error = error instanceof Error ? error.message : String(error);
      console.error("Moon AdBlock failed to initialize", error);
    }
    this.#broadcast();
  }

  refresh(): void { this.#broadcast(); }

  status(profileId: string): AdblockStatus {
    const enabled = this.privacy.settings(profileId).trackerProtection;
    return {
      phase: enabled ? this.#phase : "disabled",
      enabled,
      blockedCount: this.#blockedCounts.get(profileId) ?? 0,
      ...(this.#error ? { error: this.#error } : {})
    };
  }

  #beforeRequest(details: Electron.OnBeforeRequestListenerDetails, session: Session): Promise<Electron.CallbackResponse> | undefined {
    const blocker = this.#blocker; if (!blocker || !this.privacy.blocksTrackers(session, details) || shouldBypassContentBlocking(details)) return undefined;
    return new Promise(resolve => blocker.onBeforeRequest(details, result => {
      const owner = this.privacy.persistentOwner(session);
      if (result.cancel && owner) {
        this.#blockedCounts.set(owner, (this.#blockedCounts.get(owner) ?? 0) + 1);
        this.#broadcast();
      }
      resolve(result);
    }));
  }

  #headersReceived(details: Electron.OnHeadersReceivedListenerDetails, session: Session): Promise<Electron.HeadersReceivedResponse> | undefined {
    const blocker = this.#blocker; if (!blocker || !this.privacy.blocksTrackers(session, details)) return undefined;
    return new Promise(resolve => blocker.onHeadersReceived(details, resolve));
  }

  #broadcast(): void {
    for (const window of this.windows.list()) {
      if (!window.webContents.isDestroyed()) {
        const id = this.windows.idForWebContents(window.webContents);
        if (id) window.webContents.send("adblock:status", this.status(this.windows.profileId(id)));
      }
    }
  }
}
