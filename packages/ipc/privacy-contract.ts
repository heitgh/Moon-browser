import type { SitePermissionRecord } from "./site-permission-contract.js";

export interface PrivacySettings {
  readonly version: 1;
  readonly trackerProtection: boolean;
  readonly networkCookies: "standard" | "block-third-party" | "block-all";
  readonly trackerExceptions: readonly string[];
  readonly cookieExceptions: readonly string[];
}

export interface PrivacyState {
  readonly settings: PrivacySettings;
  readonly editable: boolean;
  readonly warning?: string;
  readonly saved?: boolean;
  readonly protection: { readonly phase: "loading" | "active" | "disabled" | "failed"; readonly enabled: boolean };
  readonly permissions: readonly SitePermissionRecord[];
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  version: 1,
  trackerProtection: true,
  networkCookies: "standard",
  trackerExceptions: [],
  cookieExceptions: []
};

export function parsePrivacyOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Origem de site inválida.");
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("Informe uma origem como https://example.com."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*")) {
    throw new Error("Informe apenas a origem HTTP ou HTTPS, sem caminho, credenciais ou parâmetros.");
  }
  return url.origin;
}

function parseOrigins(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Informe até 100 origens.");
  return [...new Set(value.map(parsePrivacyOrigin))];
}

export function parsePrivacySettings(input: unknown): PrivacySettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Configuração de privacidade inválida.");
  const data = input as Record<string, unknown>;
  if (data.version !== 1 || typeof data.trackerProtection !== "boolean" ||
      (data.networkCookies !== "standard" && data.networkCookies !== "block-third-party" && data.networkCookies !== "block-all")) {
    throw new Error("Configuração de privacidade inválida.");
  }
  return {
    version: 1,
    trackerProtection: data.trackerProtection,
    networkCookies: data.networkCookies,
    trackerExceptions: parseOrigins(data.trackerExceptions),
    cookieExceptions: parseOrigins(data.cookieExceptions)
  };
}
