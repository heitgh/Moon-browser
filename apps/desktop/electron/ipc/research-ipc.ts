import { consentText, type NativeConsent } from "../security/native-consent.js";
import { dialog } from "electron";
import { writeFile } from "node:fs/promises";
import type { IpcRouter } from "./ipc-router.js";
import type { WindowManager } from "../main/window-manager.js";
import type { ElectronBrowserManager } from "../browser/browser-manager.js";
import type { BrowserApplicationService } from "../../application/browser-application-service.js";
import type { LocalProfileManager } from "../services/local-profile-manager.js";
import { researchUrl, scopeId, type ResearchSource } from "../../../../packages/research/research.js";

export function registerResearchIpc(router: IpcRouter, windows: WindowManager, browser: ElectronBrowserManager, application: BrowserApplicationService, profiles: LocalProfileManager, consent: NativeConsent): void {
  const windowFor = (event: Electron.IpcMainInvokeEvent): string => {
    const id = windows.idForWebContents(event.sender);
    if (!id || event.senderFrame !== event.sender.mainFrame || windows.isPrivate(id) || windows.isGuest(id)) throw new Error("Pesquisa e memória estão indisponíveis em janelas privadas ou de convidado.");
    return id;
  };
  router.register("research:capture", async (event, payload: { workspaceId: string; tabIds: string[] }) => {
    const windowId = windowFor(event);
    const scope = scopeId(payload?.workspaceId);
    if (!Array.isArray(payload.tabIds) || payload.tabIds.length < 1 || payload.tabIds.length > 5 || !payload.tabIds.every(id => typeof id === "string" && id.length <= 100)) {
      throw new Error("Selecione até cinco abas para revisar a leitura local.");
    }
    const reviewed = [...new Set(payload.tabIds)].map(id => {
      const document = browser.researchDocument(id, windowId);
      if (document.workspaceId !== scope) throw new Error("Aba fora do workspace selecionado.");
      return { id, document };
    });
    const assertContext = () => router.assertActive(event, "research:capture");
    const accepted = await consent.confirm(windows.require(windowId), windows.profileId(windowId), {
      title: "Autorizar leitura local",
      message: "Permitir que o Moon Research leia o texto visível destas abas?",
      detail: "Revise os sites. Autorize somente páginas sem dados sensíveis. O texto é analisado localmente.\n\n" +
        reviewed.map(({document}) => `${consentText(document.title, 100)} — ${new URL(document.url).origin}`).join("\n"),
      accept: "Autorizar leitura"
    }, assertContext);
    if (!accepted) throw new Error("Leitura cancelada.");
    const checkDocument = ({id, document}: (typeof reviewed)[number]) => {
      assertContext();
      const current = browser.researchDocument(id, windowId);
      if (current.contentsId !== document.contentsId || current.version !== document.version || current.url !== document.url || current.workspaceId !== scope) {
        throw new Error("O documento mudou após a revisão. Selecione as abas novamente.");
      }
    };
    const sources: ResearchSource[] = [];
    for (const item of reviewed) {
      checkDocument(item);
      sources.push(await browser.readResearchSource(item.id, windowId));
      checkDocument(item);
    }
    return sources;
  });
  router.register("research:load-memory", async (event, payload: { workspaceId: string }) => {
    const windowId = windowFor(event);
    return (await profiles.storage(windows.profileId(windowId))).loadResearchMemory(scopeId(payload?.workspaceId));
  });
  router.register("research:save-memory", async (event, payload: { workspaceId: string; value: unknown }) => {
    const windowId = windowFor(event);
    return (await profiles.storage(windows.profileId(windowId))).saveResearchMemory(scopeId(payload?.workspaceId), payload.value);
  });
  router.register("research:session-urls", async (event, payload: { workspaceId: string }) => {
    const windowId = windowFor(event); const scope = scopeId(payload?.workspaceId);
    return [...new Set((await browser.getTabs(windowId)).filter(t => !t.private && (t.workspaceId ?? "research") === scope).flatMap(t => { try { return [researchUrl(t.url)]; } catch { return []; } }))].slice(0, 50);
  });
  const restores = new Set<string>();
  router.register("research:restore-session", async (event, payload: { workspaceId: string; id: string; urls: string[] }) => {
    const windowId = windowFor(event); const scope = scopeId(payload?.workspaceId);
    if (typeof payload?.id !== "string" || !Array.isArray(payload.urls) || payload.urls.length > 50) throw new Error("Seleção de sessão inválida.");
    if (restores.has(windowId)) throw new Error("Aguarde a restauração em andamento.");
    restores.add(windowId);
    try {
      const memory = await (await profiles.storage(windows.profileId(windowId))).loadResearchMemory(scope);
      const item = memory.items.find(i => i.id === payload.id && i.category === "sessions");
      if (!item) throw new Error("Sessão expirada ou removida.");
      const urls = [...new Set(payload.urls.map(researchUrl))];
      if (!urls.every(url => item.urls.includes(url))) throw new Error("A seleção não pertence à sessão salva.");
      const existing = new Set((await browser.getTabs(windowId)).filter(t => (t.workspaceId ?? "research") === scope).map(t => t.url));
      let count = 0;
      for (const url of urls) {
        if (existing.has(url)) continue;
        await application.createTab(windowId, { url, workspaceId: scope, active: false });
        existing.add(url); count += 1;
      }
      return count;
    } finally { restores.delete(windowId); }
  });
  router.register("research:export", async (event, payload: { content: string }) => {
    windowFor(event);
    if (typeof payload?.content !== "string" || payload.content.length > 2_000_000) throw new Error("Exportação inválida ou grande demais.");
    const result = await dialog.showSaveDialog(windows.require(windowFor(event)), { title: "Exportar pesquisa e memória", defaultPath: "moon-research.md", filters: [{ name: "Markdown", extensions: ["md"] }] });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, payload.content, { mode: 0o600 }); return true;
  });
}
