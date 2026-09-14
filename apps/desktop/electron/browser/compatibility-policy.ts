import type { Session } from "electron";
import { isAuthenticationPopupUrl } from "./window-open-policy.js";

const configuredSessions = new WeakSet<Session>();
const RECOVERABLE_RENDERER_REASONS = new Set(["abnormal-exit", "crashed", "oom", "launch-failed"]);

export function configureCompatibilitySession(session: Session): void {
  if (configuredSessions.has(session)) return;
  configuredSessions.add(session);
  session.setUserAgent(sanitizeChromiumUserAgent(session.getUserAgent()));
}

export function sanitizeChromiumUserAgent(value: string): string {
  return value
    .replace(/\sElectron\/[^\s]+/gi, "")
    .replace(/\sMoon(?:Browser|\/)[^\s]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isRecoverableRendererExit(reason: string): boolean {
  return RECOVERABLE_RENDERER_REASONS.has(reason);
}

export function navigationFailureMessage(errorCode: number): string {
  if (errorCode === -106) return "Sem conexão com a internet. Confira sua rede e tente novamente.";
  if (errorCode === -105) return "O endereço do site não foi encontrado.";
  if (errorCode === -118 || errorCode === -7) return "O site demorou demais para responder.";
  if (errorCode === -200 || errorCode === -202) return "O certificado de segurança do site não pôde ser validado.";
  return "Não foi possível carregar esta página. Tente recarregar.";
}

export function shouldBypassContentBlocking(details: Pick<Electron.OnBeforeRequestListenerDetails, "url" | "resourceType">): boolean {
  if (details.resourceType === "mainFrame") return true;
  return isAuthenticationPopupUrl(details.url);
}
