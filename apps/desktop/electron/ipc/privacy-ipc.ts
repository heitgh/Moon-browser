import { parsePrivacyOrigin, parsePrivacySettings, type PrivacySettings } from "../../../../packages/ipc/privacy-contract.js";
import type { ElectronBrowserManager } from "../browser/browser-manager.js";
import type { WindowManager } from "../main/window-manager.js";
import type { NativeConsent } from "../security/native-consent.js";
import type { ElectronAdblockService } from "../services/adblock-service.js";
import type { LocalProfileManager } from "../services/local-profile-manager.js";
import type { PrivacyService } from "../services/privacy-service.js";
import type { IpcRouter } from "./ipc-router.js";

export function registerPrivacyIpc(router: IpcRouter, windows: WindowManager, profiles: LocalProfileManager, privacy: PrivacyService,
  adblock: ElectronAdblockService, consent: NativeConsent, browser: ElectronBrowserManager): void {
  const updating = new Set<string>();
  function scope(event: Electron.IpcMainInvokeEvent, normal = false) {
    const windowId = windows.idForWebContents(event.sender);
    if (!windowId) throw new Error("Janela indisponível.");
    const editable = !windows.isPrivate(windowId) && !windows.isGuest(windowId);
    if (normal && !editable) throw new Error("Abra a privacidade em uma janela normal do perfil.");
    return { windowId, profileId: windows.profileId(windowId), editable };
  }
  function state(event: Electron.IpcMainInvokeEvent) {
    const {windowId, profileId, editable} = scope(event);
    return {
      settings: privacy.settings(profileId),
      warning: privacy.warning(profileId),
      editable,
      protection: adblock.status(profileId),
      permissions: editable ? browser.listPermissions(windowId) : []
    };
  }
  async function save(event: Electron.IpcMainInvokeEvent, next: PrivacySettings, channel: string) {
    const {windowId, profileId} = scope(event, true);
    if (updating.has(profileId)) throw new Error("Aguarde a alteração de privacidade em andamento.");
    updating.add(profileId);
    const assertContext = () => router.assertActive(event, channel);
    try {
      const cookieLabel = {
        standard: "Padrão do Chromium",
        "block-third-party": "Bloquear cookies HTTP de terceiros",
        "block-all": "Bloquear todos os cookies HTTP"
      }[next.networkCookies];
      const accepted = await consent.confirm(windows.require(windowId), profileId, {
        title: "Salvar privacidade",
        message: "Aplicar estas opções às próximas requisições deste perfil?",
        detail: `Proteção contra rastreadores: ${next.trackerProtection ? "ativa" : "desativada"}.\nCookies: ${cookieLabel}.\nExceções de rastreadores: ${next.trackerExceptions.length}.\nExceções de cookies: ${next.cookieExceptions.length}.\nAlguns sites podem exigir exceções para funcionar.`,
        accept: "Aplicar opções"
      }, assertContext);
      if (!accepted) return { ...state(event), saved: false };
      assertContext();
      const settings = await profiles.openedStorage(profileId).savePrivacySettings(next);
      privacy.hydrate(profileId, settings);
      adblock.refresh();
      assertContext();
      return { ...state(event), saved: true };
    } finally {
      updating.delete(profileId);
    }
  }
  router.register("privacy:state", (event, value) => {
    if (value !== undefined) throw new TypeError("A consulta não aceita parâmetros.");
    return state(event);
  });
  router.register("privacy:configure", (event, value) => save(event, parsePrivacySettings(value), "privacy:configure"));
  router.register("adblock:get-status", event => adblock.status(scope(event).profileId));
  router.register("adblock:set-enabled", async (event, value: {enabled?: unknown}) => {
    const {profileId} = scope(event, true);
    if (typeof value?.enabled !== "boolean") throw new TypeError("Informe se a proteção deve ficar ativa.");
    const result = await save(event, {...privacy.settings(profileId), trackerProtection: value.enabled}, "adblock:set-enabled");
    return result.protection;
  });
  router.register("privacy:clear-site", async (event, value: {origin?: unknown}) => {
    const {windowId, profileId} = scope(event, true);
    const origin = parsePrivacyOrigin(value?.origin);
    const assertContext = () => router.assertActive(event, "privacy:clear-site");
    const accepted = await consent.confirm(windows.require(windowId), profileId, {
      title: "Excluir dados do site",
      message: `Remover cookies e dados de ${origin}?`,
      detail: "A limpeza abrange a sessão padrão e as áreas conhecidas deste perfil. Pode encerrar sessões e remover dados offline. Favoritos e histórico ficam separados.",
      accept: "Excluir dados do site"
    }, assertContext);
    if (!accepted) return false;
    const {workspaces} = await profiles.openedStorage(profileId).loadProfileData();
    assertContext();
    await privacy.clearSiteData(profileId, origin, workspaces.map(workspace => workspace.id), assertContext);
    return true;
  });
}
