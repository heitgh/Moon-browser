import { getDomain } from "tldts-experimental";
import { session as chromiumSessions, type Session, type WebContents, type WebFrameMain } from "electron";
import { DEFAULT_PRIVACY_SETTINGS, parsePrivacySettings, type PrivacySettings } from "../../../../packages/ipc/privacy-contract.js";
import { permissionOrigin } from "../security/permission-origin.js";
import type { SessionRequestPipeline } from "../security/session-request-pipeline.js";

interface NetworkRequest {
  readonly url: string;
  readonly resourceType: string;
  readonly frame?: WebFrameMain | null;
  readonly webContents?: WebContents;
  readonly initiatorOrigin?: string;
}

function topOrigin(details: NetworkRequest): string | undefined {
  if (details.resourceType === "mainFrame") return permissionOrigin(details.url);
  try {
    return permissionOrigin(details.frame?.top?.url ?? details.webContents?.mainFrame.url);
  } catch {
    return undefined;
  }
}

function site(origin: string): string {
  const url = new URL(origin);
  return url.protocol + "//" + (getDomain(url.hostname, { allowPrivateDomains: true }) ?? url.hostname);
}

export function blocksNetworkCookies(settings: PrivacySettings, details: NetworkRequest): boolean {
  if (settings.networkCookies === "standard") return false;
  const destination = permissionOrigin(details.url);
  if (!destination) return false;
  const top = topOrigin(details);
  if (top && settings.cookieExceptions.includes(top)) return false;
  if (settings.networkCookies === "block-all") return true;
  if (!top) return true;
  const initiator = permissionOrigin(details.initiatorOrigin);
  return site(top) !== site(destination) ||
    (details.resourceType !== "mainFrame" && initiator !== undefined && site(initiator) !== site(top));
}

export class PrivacyService {
  readonly #profiles = new Map<string, PrivacySettings>();
  readonly #warnings = new Map<string, string>();
  readonly #persistentSessions = new Map<string, Set<Session>>();
  readonly #owners = new WeakMap<Session, {profileId: string; persistent: boolean}>();

  constructor(pipeline: SessionRequestPipeline) {
    pipeline.register({
      id: "network-cookies",
      beforeSendHeaders: (details, session) => {
        if (!this.#blocksCookies(session, details)) return;
        return { requestHeaders: Object.fromEntries(Object.entries(details.requestHeaders).filter(([name]) => name.toLowerCase() !== "cookie")) };
      },
      headersReceived: (details, session) => {
        if (!details.responseHeaders || !this.#blocksCookies(session, details)) return;
        return { responseHeaders: Object.fromEntries(Object.entries(details.responseHeaders).filter(([name]) => !["set-cookie", "set-cookie2"].includes(name.toLowerCase()))) };
      }
    });
  }

  hydrate(profileId: string, settings: unknown, warning?: string): void {
    this.#profiles.set(profileId, parsePrivacySettings(settings));
    if (warning) this.#warnings.set(profileId, warning);
    else this.#warnings.delete(profileId);
  }

  settings(profileId: string): PrivacySettings {
    return this.#profiles.get(profileId) ?? DEFAULT_PRIVACY_SETTINGS;
  }

  warning(profileId: string): string | undefined { return this.#warnings.get(profileId); }

  forget(profileId: string): void {
    this.#profiles.delete(profileId);
    this.#warnings.delete(profileId);
    this.#persistentSessions.delete(profileId);
  }

  registerSession(session: Session, profileId: string, persistent: boolean): void {
    const previous = this.#owners.get(session);
    if (previous && previous.profileId !== profileId) throw new Error("Sessão Chromium compartilhada entre perfis.");
    this.#owners.set(session, {profileId, persistent});
    if (persistent) {
      const known = this.#persistentSessions.get(profileId) ?? new Set<Session>();
      known.add(session);
      this.#persistentSessions.set(profileId, known);
    }
  }

  async clearSiteData(profileId: string, origin: string, workspaceIds: readonly string[], assertContext: () => void): Promise<void> {
    const sessions = new Set(this.#persistentSessions.get(profileId));
    sessions.add(chromiumSessions.fromPartition(`persist:profile:${profileId}:default`));
    for (const id of workspaceIds) {
      sessions.add(chromiumSessions.fromPartition(`persist:profile:${profileId}:workspace:${id}`));
    }
    let failures = 0;
    for (const session of sessions) {
      assertContext();
      try {
        await session.clearData({
          origins: [origin],
          dataTypes: ["cookies", "cache", "indexedDB", "localStorage", "serviceWorkers", "fileSystems", "webSQL"],
          originMatchingMode: "origin-in-all-contexts"
        });
      } catch {
        failures++;
      }
    }
    if (failures) throw new Error("Alguns dados do site não puderam ser removidos. Confira as abas abertas e tente novamente.");
  }

  persistentOwner(session: Session): string | undefined {
    const owner = this.#owners.get(session);
    return owner?.persistent ? owner.profileId : undefined;
  }

  blocksTrackers(session: Session, request: NetworkRequest): boolean {
    const settings = this.settings(this.#owners.get(session)?.profileId ?? "");
    const origin = topOrigin(request);
    return settings.trackerProtection && (!origin || !settings.trackerExceptions.includes(origin));
  }

  #blocksCookies(session: Session, request: NetworkRequest): boolean {
    const owner = this.#owners.get(session)?.profileId;
    return owner !== undefined && blocksNetworkCookies(this.settings(owner), request);
  }
}
